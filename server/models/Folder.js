const mongoose = require('mongoose')
const Schema = mongoose.Schema

const folderSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        parentFolder: {
            type: Schema.Types.ObjectId,
            ref: 'Folder',
            default: null,
            index: true,
        },
        files: [
            {
                type: Schema.Types.ObjectId,
                ref: 'File',
            },
        ],
        isPublic: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
)

folderSchema.index({ name: 1, user: 1, parentFolder: 1 }, { unique: true })

const Folder = mongoose.model('Folder', folderSchema)
module.exports = Folder
