const mongoose = require('mongoose')
const Folder = require('../models/Folder')
const File = require('../models/File')
const { body, query, param, validationResult } = require('express-validator')
const { Storage } = require('megajs')
require('dotenv').config()

// Подключение к Mega один раз при старте (можно вынести в отдельный модуль)
const initializeMega = async () => {
    const storage = new Storage({
        email: process.env.MEGA_EMAIL,
        password: process.env.MEGA_PASSWORD,
    })
    await storage.ready
    return storage
}

const ensureMegaStructure = async (storage, userId) => {
    const rootFolder = storage.root
    let docuNestFolder = rootFolder.children.find((f) => f.name === 'DocuNest')

    if (!docuNestFolder) {
        docuNestFolder = await rootFolder.mkdir('DocuNest')
    }

    let userFolder = docuNestFolder.children.find((f) => f.name === userId) // Используем userId
    if (!userFolder) {
        userFolder = await docuNestFolder.mkdir(userId) // Создаем папку с именем userId
    }

    return { docuNestFolder, userFolder }
}

const getFolders = [
    query('parentId')
        .optional()
        .custom((value) => {
            if (value === 'null') return true
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid parentId format')
            }
            return true
        })
        .withMessage('Invalid parentId format'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { parentId } = req.query
            const query = { user: req.userID }

            if (parentId) {
                query.parentFolder = parentId === 'null' ? null : parentId
            }

            const folders = await Folder.find(query)
                .populate('parentFolder', 'name')
                .populate('files', 'name url')

            res.status(200).json(folders)
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const createFolder = [
    body('name')
        .isLength({ min: 1, max: 64 })
        .withMessage('Name must be 1-64 characters long')
        .trim(),
    body('parentFolder')
        .optional({ nullable: true })
        .custom((value) => {
            if (value === null) return true
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid parentFolder ID')
            }
            return true
        })
        .withMessage('Invalid parentFolder ID'),
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic must be a boolean'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { name, parentFolder, isPublic } = req.body
            const userId = req.userID

            if (!userId) {
                return res
                    .status(401)
                    .json({ message: 'User ID not found in token' })
            }

            const storage = await initializeMega()
            const { userFolder } = await ensureMegaStructure(storage, userId)

            const createFolderWithRetry = async (
                parentFolder,
                name,
                retries = 5,
                delay = 5000
            ) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        console.log(
                            `Attempting to create folder "${name}" in Mega under parent ID:`,
                            parentFolder.nodeId
                        )
                        const megaFolder = await parentFolder.mkdir(name)
                        console.log(
                            `Folder "${name}" created successfully with ID:`,
                            megaFolder.nodeId
                        )
                        return megaFolder
                    } catch (err) {
                        if (err.message.includes('EAGAIN') && i < retries - 1) {
                            console.log(
                                `Retrying mkdir (${i + 1}/${retries}) after ${delay}ms...`
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

            let megaFolder
            if (parentFolder) {
                // Находим родительскую папку в MongoDB
                const parentFolderDoc = await Folder.findOne({
                    _id: parentFolder,
                    user: req.userID,
                })
                if (!parentFolderDoc) {
                    return res
                        .status(404)
                        .json({ message: 'Parent folder not found in MongoDB' })
                }

                // Извлекаем nodeId из megaUrl (например, "https://mega.nz/fm/<nodeId>")
                const parentNodeId = parentFolderDoc.megaUrl.split('/fm/')[1]
                console.log(
                    'Looking for parent folder in Mega with nodeId:',
                    parentNodeId
                )

                // Ищем родительскую папку в Mega по nodeId
                const parentMegaFolder = storage.root.children
                    .flatMap((f) => f.children || []) // DocuNest и ниже
                    .flatMap((f) => f.children || []) // <userId> и ниже
                    .find((f) => f.nodeId === parentNodeId)

                if (!parentMegaFolder) {
                    return res
                        .status(404)
                        .json({ message: 'Parent folder not found in Mega' })
                }

                // Создаем новую папку внутри найденной родительской папки
                megaFolder = await createFolderWithRetry(parentMegaFolder, name)
            } else {
                // Создаем папку в корневой директории пользователя, если parentFolder не указан
                megaFolder = await createFolderWithRetry(userFolder, name)
            }

            // Формируем внутреннюю ссылку
            const megaUrl = `https://mega.nz/fm/${megaFolder.nodeId}`
            console.log('Generated internal Mega link:', megaUrl)

            // Сохраняем в MongoDB
            const folder = new Folder({
                name,
                user: req.userID,
                parentFolder: parentFolder || null,
                isPublic: isPublic || false,
                megaUrl,
            })

            await folder.save()
            res.status(201).json({ message: 'Folder created', megaUrl })
        } catch (err) {
            console.error('Folder creation error:', err.message, err.stack)
            if (err.message.includes('EAGAIN')) {
                return res.status(503).json({
                    message:
                        'Mega server is temporarily unavailable. Please try again later.',
                    error: err.message,
                })
            }
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const getFolderById = [
    param('id').isMongoId().withMessage('Invalid folder ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const folder = await Folder.findOne({
                _id: req.params.id,
                user: req.userID,
            })
                .populate('parentFolder', 'name')
                .populate('files', 'name url')

            if (!folder) {
                return res.status(404).json({ message: 'Folder not found' })
            }

            res.status(200).json(folder)
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const updateFolder = [
    param('id').isMongoId().withMessage('Invalid folder ID'),
    body('name')
        .optional()
        .isLength({ min: 1, max: 64 })
        .withMessage('Name must be 1-64 characters long')
        .trim(),
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic must be a boolean'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { name, isPublic } = req.body
            const updateData = {}
            if (name) updateData.name = name
            if (typeof isPublic !== 'undefined') updateData.isPublic = isPublic
            updateData.updatedAt = Date.now()

            const folder = await Folder.findOneAndUpdate(
                { _id: req.params.id, user: req.userID },
                updateData,
                { new: true, runValidators: true }
            )

            if (!folder) {
                return res.status(404).json({ message: 'Folder not found' })
            }

            res.status(200).json({ message: 'Folder updated', folder })
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({
                    message:
                        'Folder with this name already exists in this location',
                })
            }
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const deleteFolder = [
    param('id').isMongoId().withMessage('Invalid folder ID'),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const folder = await Folder.findOne({
                _id: req.params.id,
                user: req.userID,
            })
            if (!folder) {
                return res.status(404).json({ message: 'Folder not found' })
            }

            await Folder.deleteMany({
                parentFolder: folder._id,
                user: req.userID,
            })
            await Folder.deleteOne({ _id: folder._id })

            res.status(200).json({ message: 'Folder deleted' })
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const getPublicFoldersByUser = async (req, res) => {
    try {
        const userId = req.params.id
        const folders = await Folder.find({
            user: userId,
            isPublic: true,
        })
            .populate('user', 'username')
            .populate('files', 'name url')

        res.status(200).json(folders)
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message })
    }
}

module.exports = {
    getFolders,
    createFolder,
    getFolderById,
    updateFolder,
    deleteFolder,
    getPublicFoldersByUser,
}
