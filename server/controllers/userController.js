const User = require('../models/User')
const { body, validationResult } = require('express-validator')

const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.userID).select('-password')
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }
        res.status(200).json({
            id: user._id,
            email: user.email,
            username: user.username,
        })
    } catch (err) {
        res.status(500).json({ message: 'Server error', err })
    }
}

const getUserByUsername = async (req, res) => {
    try {
        const user = await User.findOne({
            username: req.params.username,
        }).select('-password')
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }
        res.status(200).json(user)
    } catch (err) {
        res.status(500).json({ message: 'Server error', err })
    }
}

const updateUser = [
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('username')
        .optional()
        .isLength({ min: 4, max: 16 })
        .withMessage('Username must be 4-16 characters long'),

    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { email, username } = req.body
        if (!email && !username) {
            return res.status(400).json({
                message:
                    'At least one field (email or username) must be provided',
            })
        }

        try {
            const user = await User.findById(req.userID)
            if (!user) {
                return res.status(404).json({ message: 'User not found' })
            }

            const updates = {}
            if (email && email !== user.email) {
                if (await User.findOne({ email })) {
                    return res
                        .status(400)
                        .json({ message: 'Email already exists' })
                }
                updates.email = email
            }
            if (username && username !== user.username) {
                if (await User.findOne({ username })) {
                    return res
                        .status(400)
                        .json({ message: 'Username already exists' })
                }
                updates.username = username
            }

            await User.updateOne({ _id: req.userID }, { $set: updates })
            const updatedUser = await User.findById(req.userID).select(
                '-password'
            )
            res.status(200).json({
                message: 'User updated successfully',
                email: updatedUser.email,
                username: updatedUser.username,
            })
        } catch (err) {
            res.status(500).json({
                message: 'Server error',
                error: err.message,
            })
        }
    },
]

const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.userID)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        await User.deleteOne({ _id: req.userID })
        res.clearCookie('accessToken')
        res.clearCookie('refreshToken')
        res.status(200).json({ message: 'User deleted successfully' })
    } catch (err) {
        res.status(500).json({ message: 'Server error', err })
    }
}

module.exports = { getUser, getUserByUsername, updateUser, deleteUser }
