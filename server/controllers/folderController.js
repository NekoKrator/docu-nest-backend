const mongoose = require('mongoose')
const Folder = require('../models/Folder')
const File = require('../models/File')
const { body, query, param, validationResult } = require('express-validator')

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

            const folder = new Folder({
                name,
                user: req.userID,
                parentFolder: parentFolder || null,
                isPublic: isPublic || false,
            })

            await folder.save()
            res.status(201).json({ message: 'Folder created', folder })
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
