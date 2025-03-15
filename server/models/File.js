const mongoose = require('mongoose')
const Schema = mongoose.Schema

const fileSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        url: { type: String, required: true },
        folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        size: { type: Number, default: 0 },
        tags: { type: [String], default: [] },
        readingProgress: { type: Number, default: 0 },
    },
    { timestamps: true }
)

const File = mongoose.model('File', fileSchema)
module.exports = File
