const mongoose = require('mongoose')
require('dotenv').config()

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('Connected to the database')
    } catch (err) {
        console.error('Database connection failed:', err.message)
        process.exit(1)
    }
}

module.exports = connectDB
