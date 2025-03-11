const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const bcrypt = require('bcryptjs')

const register = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('username')
        .isLength({ min: 4 })
        .withMessage('Username must be at least 4 characters'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),

    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { email, username, password } = req.body

            const existingUser = await User.findOne({
                $or: [{ email }, { username }],
            })
            if (existingUser) {
                return res
                    .status(400)
                    .json({ message: 'Email or username already taken' })
            }

            const hashedPassword = await bcrypt.hash(password, 10)

            const user = new User({
                email,
                username,
                password: hashedPassword,
            })
            await user.save()

            res.status(201).json({
                message: 'User registered successfully',
            })
        } catch (err) {
            res.status(500).json({ message: 'Server error' })
        }
    },
]

module.exports = { register }
