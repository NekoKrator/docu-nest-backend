const express = require('express')
const router = express.Router()

const authRoutes = require('./authRoutes')
const userRoutes = require('./userRoutes')
const folderRoutes = require('./folderRoutes')
const fileRoutes = require('./fileRoutes')
// const tagRoutes = require('./tagRoutes')
// const publicRoutes = require('./publicRoutes')

router.use('/auth', authRoutes)
router.use('/user', userRoutes)
router.use('/folders', folderRoutes)
router.use('/files', fileRoutes)
// router.use('/tags', tagRoutes)
// router.use('/public', publicRoutes)

module.exports = router
