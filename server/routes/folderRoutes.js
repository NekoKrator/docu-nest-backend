const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const folderController = require('../controllers/folderController')

const router = express.Router()

router.get('/', authMiddleware, folderController.getFolders)
router.post('/', authMiddleware, folderController.createFolder)
router.get('/public/:id', folderController.getPublicFoldersByUser)
router.get('/:id', authMiddleware, folderController.getFolderById)
router.put('/:id', authMiddleware, folderController.updateFolder)
router.delete('/:id', authMiddleware, folderController.deleteFolder)

module.exports = router
