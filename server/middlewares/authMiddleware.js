const jwt = require('jsonwebtoken')
require('dotenv').config()

const authMiddleware = async (req, res, next) => {
    try {
        let token
        const authHeader = req.headers.authorization

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1]
        } else {
            token = req.cookies.accessToken
        }

        if (!token) {
            return res.status(401).json({ message: 'No token provided' })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        req.userID = decoded.userID

        next()
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' })
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' })
        }

        return res.status(500).json({ message: 'Server error', err })
    }
}

module.exports = authMiddleware
