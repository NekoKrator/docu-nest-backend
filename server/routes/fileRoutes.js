const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware') // Предполагается, что он есть
const fileController = require('../controllers/fileController')

const router = express.Router()

router.post('/', authMiddleware, fileController.createPdf)
router.get('/:id', authMiddleware, fileController.getPdfById)
router.put('/:id', authMiddleware, fileController.updatePdf)
router.delete('/:id', authMiddleware, fileController.deletePdf)
router.get('/download/:id', authMiddleware, fileController.downloadPdf)

module.exports = router
