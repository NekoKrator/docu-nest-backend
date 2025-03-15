const mongoose = require('mongoose')
const Folder = require('../models/Folder')
const File = require('../models/File')
const { body, param, validationResult } = require('express-validator')
const multer = require('multer')
const { initializeMega } = require('./folderController') // Импортируем
const fs = require('fs').promises
require('dotenv').config()

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const findFolderByNodeId = (folder, nodeId) => {
    if (!folder || !folder.children) return null
    if (folder.nodeId === nodeId) return folder

    for (const child of folder.children) {
        const found = findFolderByNodeId(child, nodeId)
        if (found) return found
    }
    return null
}

// POST /api/pdfs - Загрузка нового PDF на Mega
const createPdf = [
    upload.single('file'),
    body('name')
        .isLength({ min: 1, max: 128 })
        .withMessage('Name must be 1-128 characters long')
        .trim(),
    body('folder')
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid folder ID')
            }
            return true
        })
        .withMessage('Invalid folder ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array())
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { name, folder } = req.body
            const fileBuffer = req.file.buffer
            const userId = req.userID

            if (!userId) {
                return res
                    .status(401)
                    .json({ message: 'User ID not found in token' })
            }

            // Проверка существования папки в MongoDB
            const folderDoc = await Folder.findOne({
                _id: folder,
                user: userId,
            })
            if (!folderDoc) {
                return res
                    .status(404)
                    .json({ message: 'Folder not found in MongoDB' })
            }

            // Подключение к Mega
            const storage = await initializeMega()
            const folderNodeId = folderDoc.megaUrl.split('/fm/')[1]
            console.log('Target folder nodeId:', folderNodeId)

            // Рекурсивный поиск папки в Mega
            const targetFolder = findFolderByNodeId(storage.root, folderNodeId)
            if (!targetFolder) {
                return res
                    .status(404)
                    .json({ message: 'Target folder not found in Mega' })
            }

            // Загрузка файла в указанную папку
            const uploadWithRetry = async (
                targetFolder,
                name,
                buffer,
                retries = 5,
                delay = 5000
            ) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        console.log(
                            `Attempting to upload file "${name}" to Mega in folder:`,
                            targetFolder.nodeId
                        )
                        const megaFile = await targetFolder.upload(
                            {
                                name: `${Date.now()}-${name}`,
                                size: buffer.length,
                            },
                            buffer
                        ).complete
                        console.log(
                            `File "${name}" uploaded successfully with ID:`,
                            megaFile.nodeId
                        )
                        return megaFile
                    } catch (err) {
                        if (err.message.includes('EAGAIN') && i < retries - 1) {
                            console.log(
                                `Retrying upload (${i + 1}/${retries}) after ${delay}ms...`
                            )
                            await new Promise((resolve) =>
                                setTimeout(resolve, delay)
                            )
                            continue
                        }
                        throw err
                    }
                }
            }

            const megaFile = await uploadWithRetry(
                targetFolder,
                name,
                fileBuffer
            )
            const url = `https://mega.nz/fm/${megaFile.nodeId}`

            // Сохранение метаданных в MongoDB
            const file = new File({
                name,
                url,
                folder: folderDoc._id,
                user: userId,
                size: fileBuffer.length,
            })

            await file.save()
            res.status(201).json({
                message: 'File uploaded to Mega',
                file: file.toObject(),
            })
        } catch (err) {
            console.error('Upload error:', err.message, err.stack)
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const getPdfById = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            const file = await File.findOne({
                _id: req.params.id,
                user: req.userID,
            }).populate('folder', 'name megaUrl')
            if (!file) {
                return res.status(404).json({ message: 'File not found' })
            }
            res.status(200).json(file)
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const updatePdf = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    body('name')
        .optional()
        .isLength({ min: 1, max: 128 })
        .withMessage('Name must be 1-128 characters long')
        .trim(),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            const { name } = req.body
            const updateData = {}
            if (name) updateData.name = name
            updateData.updatedAt = Date.now()

            const file = await File.findOneAndUpdate(
                { _id: req.params.id, user: req.userID },
                updateData,
                { new: true, runValidators: true }
            )
            if (!file) {
                return res.status(404).json({ message: 'File not found' })
            }
            res.status(200).json({ message: 'File updated', file })
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const deletePdf = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            const file = await File.findOne({
                _id: req.params.id,
                user: req.userID,
            })
            if (!file) {
                return res.status(404).json({ message: 'File not found' })
            }

            const storage = await initializeMega()
            const fileNodeId = file.url.split('/fm/')[1]
            const megaFile = storage.root.children
                .flatMap((f) => f.children || [])
                .flatMap((f) => f.children || [])
                .find((f) => f.nodeId === fileNodeId)

            if (megaFile) {
                await megaFile.delete()
            }

            await File.deleteOne({ _id: file._id })
            res.status(200).json({ message: 'File deleted' })
        } catch (err) {
            console.error('Delete error:', err.message, err.stack)
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const downloadPdf = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            const file = await File.findOne({
                _id: req.params.id,
                user: req.userID,
            })
            if (!file) {
                return res.status(404).json({ message: 'File not found' })
            }
            res.status(200).json({ url: file.url }) // Возвращаем внутреннюю ссылку
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

module.exports = {
    createPdf,
    getPdfById,
    updatePdf,
    deletePdf,
    downloadPdf,
}
