const mongoose = require('mongoose')
const Schema = mongoose.Schema

const fileSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        url: {
            type: String,
            required: true,
        },
        folder: {
            type: Schema.Types.ObjectId,
            ref: 'Folder',
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
)

const File = mongoose.model('File', fileSchema)
module.exports = File
