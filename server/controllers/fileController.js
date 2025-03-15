const mongoose = require('mongoose')
const Folder = require('../models/Folder')
const File = require('../models/File')
const { body, param, validationResult } = require('express-validator')
const multer = require('multer')
const { Storage } = require('megajs')
const fs = require('fs').promises
require('dotenv').config()

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

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

            // Проверка существования папки
            const folderDoc = await Folder.findOne({
                _id: folder,
                user: req.userID,
            })
            if (!folderDoc) {
                return res.status(404).json({ message: 'Folder not found' })
            }

            // Подключение к Mega
            const storage = new Storage({
                email: process.env.MEGA_EMAIL,
                password: process.env.MEGA_PASSWORD,
            })
            await storage.ready

            // Загрузка файла на Mega
            const megaFile = await storage.upload(
                `${Date.now()}-${name}`,
                fileBuffer
            ).complete
            const url = megaFile.downloadUrl

            // Сохранение метаданных в базе данных
            const file = new File({
                name,
                url,
                folder,
                user: req.userID,
                size: fileBuffer.length,
            })

            await file.save()
            res.status(201).json({
                message: 'PDF uploaded to Mega',
                id: file._id,
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

// GET /api/pdfs/:id - Получение информации о PDF
const getPdfById = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            // Логика получения информации о PDF (пока пустая)
            res.status(200).json({ message: 'Get PDF by ID not implemented' })
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

// PUT /api/pdfs/:id - Обновление PDF
const updatePdf = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            // Логика обновления PDF (пока пустая)
            res.status(200).json({ message: 'Update PDF not implemented' })
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

// DELETE /api/pdfs/:id - Удаление PDF
const deletePdf = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            // Логика удаления PDF (пока пустая)
            res.status(200).json({ message: 'Delete PDF not implemented' })
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

// GET /api/pdfs/download/:id - Скачивание PDF
const downloadPdf = [
    param('id').isMongoId().withMessage('Invalid file ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            // Логика скачивания PDF (пока пустая)
            res.status(200).json({ message: 'Download PDF not implemented' })
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
