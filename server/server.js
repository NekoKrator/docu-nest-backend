const express = require('express')
const mongoose = require('mongoose')
const routes = require('./routes/index')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use('/api', routes)

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to the database')

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`)
        })
    })
    .catch((err) => {
        console.error('Database connection failed:', err.message)
        process.exit(1)
    })
