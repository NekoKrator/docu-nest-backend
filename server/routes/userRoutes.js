const express = require('express')
const router = express.Router()
const userController = require('../controllers/userController')
const authMiddleware = require('../middlewares/authMiddleware')

router.get('/me', authMiddleware, userController.getUser)
router.patch('/me', authMiddleware, userController.updateUser)
router.delete('/me', authMiddleware, userController.deleteUser)

module.exports = router
