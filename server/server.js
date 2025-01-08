// Mock API Server (mevcut server.js)
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

function startServer(retryPort = port) {
    app.listen(retryPort, () => {
        console.log(`Mock API server running at http://localhost:${retryPort}`)
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${retryPort} is busy, trying ${retryPort + 1}...`)
            startServer(retryPort + 1)
        }
    })
}

// Root path için basit bir response
app.get('/', (req, res) => {
    res.json({
        status: 'Azerite UO Update Server is running',
        endpoints: {
            version: '/api/version'
        }
    })
})

app.get('/api/version', (req, res) => {
    res.json({
        version: '1.0.1',
        patches: [
            {
                version: '1.0.1',
                url: 'http://localhost:3000/patches/1.0.1.zip',
                changes: ['Bug fixes', 'New features']
            }
        ]
    })
})

// API hata yakalama
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Path ${req.path} not found`
    })
})

startServer() 