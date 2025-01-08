const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const config = require('./config.js')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Hot Reload (sadece development modunda çalışır)
try {
    require('electron-reloader')(module, {
        debug: true,
        watchRenderer: true
    });
} catch (_) { console.log('Error loading electron-reloader'); }

let mainWindow
const CLIENT_PATH = config.clientPath

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
  mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
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

// Client path kontrolü
function checkClientPath() {
    try {
        return fs.existsSync(CLIENT_PATH)
    } catch (error) {
        console.error('Error checking client path:', error)
        return false
    }
}

// Version kontrol fonksiyonu
async function checkVersion() {
    try {
        const response = await fetch(`${config.updateServer}${config.versionCheckEndpoint}`)
        const data = await response.json()
        
        return {
            currentVersion: config.currentVersion,
            serverVersion: data.version,
            needsUpdate: data.version !== config.currentVersion,
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
            event.reply('update-status', `Update available: ${versionInfo.serverVersion}`)
        } else {
            event.reply('update-status', 'Client is up to date')
        }
    } catch (error) {
        event.reply('update-status', 'Error checking version: ' + error.message)
    }
})

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