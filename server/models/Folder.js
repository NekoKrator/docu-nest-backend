const mongoose = require('mongoose')

const FolderSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 64 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentFolder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null,
    },
    isPublic: { type: Boolean, default: false },
    megaUrl: { type: String, required: true },
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Folder', FolderSchema)
