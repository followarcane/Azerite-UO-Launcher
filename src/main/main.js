const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const config = require('./config.js')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

let mainWindow
let CLIENT_PATH = config.clientPath

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
    loadConfig()
    createWindow()
    if (process.env.NODE_ENV === 'development') {
        registerShutdown()
    }
})

app.on('window-all-closed', () => {
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
        const response = await fetch(`${config.updateServer}${config.versionCheckEndpoint}`)
        const data = await response.json()
        
        return {
            currentVersion: config.currentVersion,
            serverVersion: data.serverVersion,
            needsUpdate: config.currentVersion !== data.serverVersion,
            patches: data.patches
        }
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
        
        fs.writeFileSync(
            configPath,
            JSON.stringify(config, null, 2)
        );
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Ve başlangıçta config'i yüklemek için
function loadConfig() {
    try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        
        if (fs.existsSync(configPath)) {
            const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            config = { ...config, ...loadedConfig };
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

ipcMain.on('start-update', async (event) => {
    try {
        const versionInfo = await checkVersion();
        event.reply('download-progress', 0);
        
        // Update simülasyonu...
        for (let i = 0; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            event.reply('download-progress', i);
        }
        
        // Update başarılı
        config.currentVersion = versionInfo.serverVersion;
        saveConfig();
        
        // Version'u tekrar kontrol et
        const newVersionInfo = await checkVersion();
        event.reply('client-version', newVersionInfo.currentVersion);
        
        event.reply('update-status', {
            status: 'Update completed successfully!',
            needsUpdate: false
        });
        
        event.reply('update-completed');
        
    } catch (error) {
        event.reply('update-status', {
            status: 'Update failed: ' + error.message,
            needsUpdate: true
        });
    }
}); 