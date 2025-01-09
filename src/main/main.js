const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const fsPromises = require('fs/promises')
const { defaults } = require('./config.js')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const JSZip = require('jszip');
const AdmZip = require('adm-zip');

// Başlangıç config değerlerini oluştur
let config = { ...defaults };
let mainWindow
let CLIENT_PATH = config.clientPath
let updateCheckInterval;
const CHECK_INTERVAL = 3600000; // 1 saat (milisaniye cinsinden)

// Hot Reload (only in development mode)
try {
    require('electron-reloader')(module, {
        debug: true,
        watchRenderer: true,
        ignore: [
            path.join(__dirname, 'config.js'),
            path.join(__dirname, 'config.json')
        ]
    });
} catch (_) { console.log('Error loading electron-reloader'); }

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,  // Minimum size
    minHeight: 720,  // Minimum size
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    // Center the window
    center: true,
    // Fix window edges
    useContentSize: true,
    backgroundColor: '#1a1a1a'
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Otomatik kontrol fonksiyonu
async function checkForUpdatesAutomatically() {
    try {
        const versionInfo = await checkVersion();
        if (versionInfo.needsUpdate) {
            // Güncellemeyi başlat
            const patch = versionInfo.patches[0];
            
            const patchDir = path.join(app.getPath('userData'), 'patches');
            await fsPromises.mkdir(patchDir, { recursive: true });
            
            const patchPath = path.join(patchDir, `patch-${patch.version}.zip`);
            
            // Renderer'a bilgi ver
            mainWindow.webContents.send('update-status', {
                status: 'Updating...',
                needsUpdate: true
            });
            
            await downloadPatch(patch.url, patchPath, (progress) => {
                mainWindow.webContents.send('download-progress', progress);
            });
            
            await installPatch(patchPath, path.dirname(CLIENT_PATH));
            
            config.currentVersion = versionInfo.serverVersion;
            saveConfig();
            
            mainWindow.webContents.send('update-status', {
                status: 'Update completed!',
                needsUpdate: false
            });
            
            mainWindow.webContents.send('update-completed');
        }
    } catch (error) {
        console.error('Update check error:', error);
        mainWindow.webContents.send('update-status', {
            status: 'Update check failed: ' + error.message,
            needsUpdate: false
        });
    }
}

// Interval başlatma fonksiyonu
function startUpdateChecks() {
    // Varolan interval'ı temizle
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }
    
    // İlk kontrolü hemen yap
    checkForUpdatesAutomatically();
    
    // Sonra her saat başı kontrol et
    updateCheckInterval = setInterval(checkForUpdatesAutomatically, CHECK_INTERVAL);
}

// Uygulama başladığında kontrolleri başlat
app.whenReady().then(() => {
    loadConfig()
    createWindow()
    startUpdateChecks()
    
    if (process.env.NODE_ENV === 'development') {
        registerShutdown()
    }
})

// Uygulama kapanırken interval'ı temizle
app.on('window-all-closed', () => {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }
    
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Check if client path exists
function checkClientPath() {
    try {
        return fs.existsSync(CLIENT_PATH)
    } catch (error) {
        console.error('Error checking client path:', error)
        return false
    }
}

// Check client version against server
async function checkVersion() {
    try {
        const response = await fetch(`http://127.0.0.1:3000${config.versionCheckEndpoint}`)
        const data = await response.json()
        
        console.log('Received data from server:', data);
        
        return {
            currentVersion: config.currentVersion,
            serverVersion: data.serverVersion,
            needsUpdate: config.currentVersion !== data.serverVersion,
            patches: data.patches.map(patch => ({
                ...patch,
                url: patch.url.replace('localhost', '127.0.0.1')  // URL'yi güncelle
            }))
        }
        
        console.log('Final patch URLs:', data.patches.map(patch => patch.url.replace('localhost', '127.0.0.1')));
    } catch (error) {
        console.error('Version check failed:', error)
        throw error
    }
}

// IPC Handlers
ipcMain.on('check-updates', async (event) => {
    try {
        const versionInfo = await checkVersion()
        
        event.reply('client-version', versionInfo.currentVersion)
        
        if (versionInfo.needsUpdate) {
            event.reply('update-status', {
                status: `Update available: ${versionInfo.serverVersion}`,
                needsUpdate: true
            });
        } else {
            event.reply('update-status', {
                status: 'Client is up to date',
                needsUpdate: false
            });
        }
    } catch (error) {
        event.reply('update-status', {
            status: 'Error checking version: ' + error.message,
            needsUpdate: false
        });
    }
});

ipcMain.on('start-client', async (event) => {
    try {
        if (!checkClientPath()) {
            event.reply('update-status', 'Error: Client not found at: ' + CLIENT_PATH)
            return
        }

        const client = spawn(CLIENT_PATH)
        
        client.on('error', (error) => {
            event.reply('update-status', 'Error starting client: ' + error.message)
        })

        client.on('spawn', () => {
            event.reply('update-status', 'Client started successfully')
        })

        client.on('close', (code) => {
            event.reply('update-status', `Client closed with code: ${code}`)
            event.reply('client-closed')
        })

    } catch (error) {
        event.reply('update-status', 'Error starting client: ' + error.message)
    }
})

ipcMain.on('select-client-path', async (event) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Executable', extensions: ['exe'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            
            // Check path
            if (selectedPath.toLowerCase().includes('client.exe') || 
                (process.platform === 'darwin' && selectedPath.toLowerCase().includes('client'))) {
                config.clientPath = selectedPath;
                // Update CLIENT_PATH constant
                CLIENT_PATH = selectedPath;
                saveConfig();
                
                event.reply('selected-client-path', selectedPath);
                event.reply('path-status', {
                    status: 'success',
                    message: 'Client path set successfully'
                });
            } else {
                event.reply('path-status', {
                    status: 'error',
                    message: 'Please select a valid UO client.exe'
                });
            }
        }
    } catch (error) {
        event.reply('path-status', {
            status: 'error',
            message: 'Error selecting client path: ' + error.message
        });
    }
});

// Save configuration to file
function saveConfig() {
    try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        
        // Tüm config değerlerini kaydet
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('Saved config:', config);
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

function loadConfig() {
    try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        
        if (fs.existsSync(configPath)) {
            const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            // Varsayılan değerler ile kaydedilmiş değerleri birleştir
            config = { ...defaults, ...loadedConfig };
            console.log('Loaded config:', config);
        } else {
            // Config dosyası yoksa varsayılan değerleri kaydet
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('Created default config');
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function registerShutdown() {
    process.on('SIGINT', () => {
        console.log('Shutting down...')
        app.quit()
    })
    
    process.on('SIGTERM', () => {
        console.log('Shutting down...')
        app.quit()
    })
}

// New functions for patch operations
async function downloadPatch(url, targetPath, onProgress) {
    console.log('Downloading patch from:', url);
    console.log('Saving to:', targetPath);
    
    const response = await fetch(url);
    const total = parseInt(response.headers.get('content-length'), 10);
    console.log('Total file size:', total, 'bytes');
    
    let downloaded = 0;
    const fileStream = fs.createWriteStream(targetPath);
    
    return new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('data', (chunk) => {
            downloaded += chunk.length;
            onProgress(Math.round((downloaded / total) * 100));
        });
        
        fileStream.on('finish', async () => {
            console.log('Download completed, file size:', downloaded, 'bytes');
            fileStream.close();
            
            try {
                const stats = await fs.promises.stat(targetPath);
                console.log('Downloaded file size:', stats.size, 'bytes');
                
                const fileContent = await fs.promises.readFile(targetPath);
                console.log('Downloaded file content length:', fileContent.length, 'bytes');
                console.log('First 100 bytes of downloaded file:', fileContent.slice(0, 100));
                
                const zip = new JSZip();
                await zip.loadAsync(fileContent);
                console.log('Zip file is valid, entries:', Object.keys(zip.files).length);
                resolve();
            } catch (error) {
                console.error('Invalid zip file:', error);
                reject(error);
            }
        });
        
        fileStream.on('error', (err) => {
            console.error('Download error:', err);
            reject(err);
        });
    });
}

async function installPatch(patchPath, targetDir) {
    try {
        console.log('Installing patch from:', patchPath);
        console.log('Target directory:', targetDir);
        
        const stats = await fs.promises.stat(patchPath);
        console.log('Patch file size:', stats.size, 'bytes');
        
        const fileContent = await fs.promises.readFile(patchPath);
        console.log('File content length:', fileContent.length, 'bytes');
        console.log('First 100 bytes:', fileContent.slice(0, 100));
        
        const zip = new AdmZip(patchPath);
        const backupPath = path.join(app.getPath('userData'), 'backups', Date.now().toString());
        
        await fs.promises.mkdir(backupPath, { recursive: true });
        
        const entries = zip.getEntries();
        console.log('Zip entries:', entries.map(e => e.entryName));
        
        zip.extractAllTo(targetDir, true);
        
        return true;
    } catch (error) {
        console.error('Install patch error:', error);
        throw error;
    }
}