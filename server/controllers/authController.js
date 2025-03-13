const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { body, validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const register = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('username')
        .isLength({ min: 4, max: 16 })
        .withMessage('Username must be 4-16 characters long'),
    body('password')
        .isLength({ min: 8, max: 32 })
        .withMessage('Password must be 8-32 characters long'),

    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { email, username, password } = req.body

            const existingUser = await User.findOne({
                $or: [{ email, username }],
            })

            if (existingUser) {
                return res
                    .status(400)
                    .json({ message: 'Email or username already exist' })
            }

            const hashedPassword = await bcrypt.hash(password, 10)

            const user = new User({ email, username, password: hashedPassword })
            await user.save()

            res.status(201).json({ message: 'User registered successfully' })
        } catch (err) {
            res.status(500).json({ message: 'Server error', err })
        }
    },
]

const login = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 8, max: 32 })
        .withMessage('Password must be 8-32 characters long'),

    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        try {
            const { email, password } = req.body

            const user = await User.findOne({ email })
            if (!user) {
                return res
                    .status(400)
                    .json({ message: 'Invalid email or password' })
            }

            const isMatch = await bcrypt.compare(password, user.password)
            if (!isMatch) {
                return res
                    .status(400)
                    .json({ message: 'Invalid email or password' })
            }

            // access token
            const accessToken = jwt.sign(
                { userID: user._id },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            )

            // refresh token
            const refreshToken = jwt.sign(
                { userID: user._id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            )

            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                maxAge: 60 * 60 * 1000,
                secure: false,
                sameSite: 'Lax',
            })

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000,
                secure: false,
                sameSite: 'Lax',
            })

            res.status(200).json({ message: 'Login successful' })
        } catch (err) {
            res.status(500).json({ message: 'Server error', err })
        }
    },
]

const refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken

    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided' })
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
        const accessToken = jwt.sign(
            { userID: decoded.userID },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            maxAge: 60 * 60 * 1000,
            secure: false,
            sameSite: 'None',
        })

        res.status(200).json({ message: 'Token refreshed successfully' })
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token expired' })
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid refresh token' })
        }
        return res.status(500).json({ message: 'Server error', err })
    }
}

const logout = async (req, res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
    })
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
    })
    res.status(200).json({ message: 'Logout successful' })
}

module.exports = { register, login, refreshToken, logout }
