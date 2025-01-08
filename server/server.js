// Mock API Server (mevcut server.js)
const express = require('express')
const expressApp = express()
const path = require('path')
const port = process.env.PORT || 3000

// Express middleware
expressApp.use(express.json())

// Root endpoint for testing
expressApp.get('/', (req, res) => {
    res.json({
        status: 'Azerite UO Update Server is running',
        endpoints: {
            version: '/api/version'
        }
    })
})

// Version check endpoint
expressApp.get('/api/version', (req, res) => {
    res.json({
        currentVersion: '1.0.0',
        serverVersion: '1.0.1',
        needsUpdate: true,
        patches: [
            {
                version: '1.0.1',
                url: 'http://localhost:3000/patches/1.0.1.zip',
                changes: ['Bug fixes', 'New features'],
                required: true
            }
        ]
    })
})

// Error handling
expressApp.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    })
})

function startServer(retryPort = port) {
    expressApp.listen(retryPort, () => {
        console.log(`Mock API server running at http://localhost:${retryPort}`)
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${retryPort} is busy, trying ${retryPort + 1}...`)
            startServer(retryPort + 1)
        } else {
            console.error('Server error:', err)
        }
    })
}

startServer() 