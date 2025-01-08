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

// Version history endpoint
expressApp.get('/api/version-history', (req, res) => {
    res.json({
        versions: [
            {
                version: '1.0.1',
                date: '2024-03-15',
                changes: [
                    'Added version history panel',
                    'Implemented auto-update system',
                    'Improved UI responsiveness'
                ],
                required: true
            },
            {
                version: '1.0.0',
                date: '2024-03-01',
                changes: [
                    'Initial release',
                    'Basic launcher functionality',
                    'Client path selection'
                ],
                required: false
            }
        ]
    });
});

// Error handling
expressApp.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    })
})

function startServer(retryPort = port) {
    expressApp.listen(retryPort, '127.0.0.1', () => {
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