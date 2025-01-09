// Mock API Server
const express = require('express')
const expressApp = express()
const path = require('path')
const port = process.env.PORT || 3000
const fs = require('fs')

// Express middleware
expressApp.use(express.json())
expressApp.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Static dosyalar için middleware
expressApp.use('/patches', express.static(path.join(__dirname, 'patches')))

// Tüm route'ları burada tanımla
const setupRoutes = () => {
    // Test endpoint'i ekleyelim
    expressApp.get('/test-patch', (req, res) => {
        res.download(path.join(__dirname, 'patches/1.0.1/patch.zip'))
    })

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
                    url: 'http://localhost:3000/patches/1.0.1/patch.zip',
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

    // Patch endpoint'i
    expressApp.get('/patches/:version/patch.zip', (req, res) => {
        const version = req.params.version;
        console.log('Patch requested for version:', version);
        
        const patchDir = path.join(__dirname, 'patches', version);
        const patchPath = path.join(patchDir, 'patch.zip');
        
        // Patch klasörünü oluştur
        if (!fs.existsSync(patchDir)) {
            fs.mkdirSync(patchDir, { recursive: true });
        }
        
        // Patch dosyası yoksa oluştur
        if (!fs.existsSync(patchPath)) {
            console.log('Creating mock patch file');
            const AdmZip = require('adm-zip');
            const zip = new AdmZip();
            
            // Mock patch dosyaları ekle
            zip.addFile('client.exe', Buffer.from('Updated client file for ' + version));
            zip.addFile('data.uop', Buffer.from('Updated data file for ' + version));
            
            // Zip'i kaydet
            zip.writeZip(patchPath);
            console.log('Mock patch file created at:', patchPath);
        }
        
        console.log('Sending patch file:', patchPath);
        res.download(patchPath);
    }); 

    expressApp.get('/patches/1.0.1.zip', (req, res) => {
        const patchPath = path.join(__dirname, 'patches', '1.0.1', 'patch.zip');
        res.download(patchPath);
    }); 

    const FULL_CLIENT_PATH = path.join(__dirname, 'full-client');

    // Full client endpoint'i
    expressApp.get('/api/client-info', (req, res) => {
        try {
            const clientInfo = require('./full-client/info.json');
            res.json(clientInfo);
        } catch (error) {
            res.status(500).json({ error: 'Could not get client info' });
        }
    });

    // Client dosyası indirme endpoint'i
    expressApp.get('/api/download-client/:file', (req, res) => {
        const filePath = path.join(FULL_CLIENT_PATH, 'files', req.params.file);
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    }); 

    // Test endpoint'i ekleyelim
    expressApp.get('/test', (req, res) => {
        res.json({ status: 'Server is running' });
    }); 

    // Full client endpoint
    expressApp.get('/api/full-client', (req, res) => {
        const fullClientPath = path.join(__dirname, 'full-client/full-game.zip');
        
        // Zip dosyası yoksa oluştur
        if (!fs.existsSync(fullClientPath)) {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip();
            
            // Mock dosyaları ekle
            Object.entries(MOCK_FILES).forEach(([fileName, content]) => {
                zip.addFile(fileName, content);
            });
            
            // Zip'i kaydet
            zip.writeZip(fullClientPath);
        }
        
        res.download(fullClientPath);
    }); 

    // Full client manifest endpoint
    expressApp.get('/api/client-manifest', (req, res) => {
        res.json({
            files: [
                {
                    path: 'client.exe',
                    size: MOCK_FILES['client.exe'].length,
                    hash: 'abc123',
                    required: true
                },
                {
                    path: 'data.uop',
                    size: MOCK_FILES['data.uop'].length,
                    hash: 'def456',
                    required: true
                }
            ]
        });
    });

    // Missing files download endpoint
    expressApp.get('/api/download-file/:file', (req, res) => {
        const fileName = req.params.file;
        const filePath = path.join(__dirname, 'full-client/files', fileName);
        
        // Klasörü oluştur
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        // Dosyayı oluştur veya güncelle
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size !== MOCK_FILES[fileName].length) {
            fs.writeFileSync(filePath, MOCK_FILES[fileName]);
        }
        
        res.download(filePath);
    });
}

// Server'ı başlat
function startServer(retryPort = port) {
    setupRoutes(); // Önce route'ları kur

    expressApp.listen(retryPort, '127.0.0.1', () => {
        console.log(`Mock API server running at http://127.0.0.1:${retryPort}`)
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${retryPort} is busy, trying ${retryPort + 1}...`)
            startServer(retryPort + 1)
        } else {
            console.error('Server error:', err)
        }
    })
}

// Mock dosya içerikleri için sabit değerler kullanalım
const MOCK_FILES = {
    'client.exe': Buffer.from('Mock client file'.repeat(1000)),  // Daha büyük dosya
    'data.uop': Buffer.from('Mock data file'.repeat(1000))      // Daha büyük dosya
};

startServer() 