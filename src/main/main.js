const { app, BrowserWindow, ipcMain, dialog, net } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const fsPromises = require('fs/promises')
const { defaults } = require('./config.js')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const JSZip = require('jszip');
const AdmZip = require('adm-zip');
const Installer = require('./installer');
const installer = new Installer();

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
      contextIsolation: false,
      devTools: true  // DevTools'u aktif et
    },
    // Center the window
    center: true,
    // Fix window edges
    useContentSize: true,
    backgroundColor: '#1a1a1a'
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  
  // Window yüklendikten sonra version bilgisini gönder
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      // Version.json'dan oku
      const userDataPath = app.getPath('userData');
      const versionPath = path.join(userDataPath, 'version.json');
      
      if (fs.existsSync(versionPath)) {
        const versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        mainWindow.webContents.send('client-version', versionInfo.version);
      } else {
        mainWindow.webContents.send('client-version', 'Not Installed');
      }
    } catch (error) {
      console.error('Error reading version:', error);
      mainWindow.webContents.send('client-version', 'Not Installed');
    }
  });
  
  mainWindow.webContents.openDevTools();
}

// Otomatik kontrol fonksiyonu
async function checkForUpdatesAutomatically() {
    try {
        const versionInfo = await checkVersion();
        console.log('Version info:', versionInfo);
        
        if (versionInfo.needsUpdate) {
            const patch = versionInfo.patches[0];
            console.log('Update needed, patch:', patch);
            
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
        console.error('Auto update check error:', error);
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
app.whenReady().then(async () => {
    // Önce config'i yükle
    config = loadConfig();
    
    // Window'u oluştur
    createWindow();
    
    // Server kontrollerini başlat
    try {
        if (config.isInstalled) {
            const versionInfo = await checkVersion();
            console.log('Initial version check:', versionInfo);
        }
    } catch (error) {
        console.error('Initial version check failed:', error);
    }
    
    startUpdateChecks();
});

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
        // Önce local version'u kontrol et
        if (!config.isInstalled || !config.installPath) {
            console.log('Game not installed');
            if (mainWindow) {
                mainWindow.webContents.send('client-version', 'Not Installed');
            }
            return { currentVersion: '', serverVersion: '', needsUpdate: false };
        }

        // Version.json'u AppData'dan oku
        const userDataPath = app.getPath('userData');
        const versionPath = path.join(userDataPath, 'version.json');
        let currentVersion = '';
        
        try {
            if (fs.existsSync(versionPath)) {
                const versionInfo = JSON.parse(await fs.promises.readFile(versionPath, 'utf8'));
                currentVersion = versionInfo.version;
            } else {
                console.log('No version.json found');
                if (mainWindow) {
                    mainWindow.webContents.send('client-version', 'Checking...');
                }
                return { currentVersion: '', serverVersion: '', needsUpdate: false };
            }
        } catch (error) {
            console.error('Error reading local version:', error);
            if (mainWindow) {
                mainWindow.webContents.send('client-version', 'Checking...');
            }
            return { currentVersion: '', serverVersion: '', needsUpdate: false };
        }

        // Server'dan son version'u al
        const response = await fetch('http://127.0.0.1:3000/api/version');
        const serverInfo = await response.json();
        
        console.log('Local version:', currentVersion);
        console.log('Server version:', serverInfo.serverVersion);
        
        const needsUpdate = currentVersion !== serverInfo.serverVersion;
        
        if (mainWindow) {
            mainWindow.webContents.send('client-version', currentVersion);
            mainWindow.webContents.send('update-status', {
                status: needsUpdate ? 'Update available' : 'Client is up to date',
                needsUpdate: needsUpdate,
                currentVersion: currentVersion,
                serverVersion: serverInfo.serverVersion
            });
        }
        
        return {
            currentVersion: currentVersion,
            serverVersion: serverInfo.serverVersion,
            needsUpdate: needsUpdate,
            patches: serverInfo.patches || []
        };
    } catch (error) {
        console.error('Version check failed:', error);
        if (mainWindow) {
            mainWindow.webContents.send('client-version', 'Checking...');
        }
        throw error;
    }
}

// IPC handler'ı güncelle
ipcMain.handle('check-updates', async () => {
    try {
        return await checkVersion();
    } catch (error) {
        console.error('Check updates error:', error);
        return {
            currentVersion: config.currentVersion || '1.0.0',
            serverVersion: null,
            needsUpdate: false,
            error: error.message
        };
    }
});

// Start client handler
ipcMain.handle('start-client', async () => {
    try {
        if (!checkClientPath()) {
            throw new Error('Client not found at: ' + config.clientPath);
        }

        const client = spawn(config.clientPath);
        
        return new Promise((resolve, reject) => {
            client.on('error', (error) => {
                reject(error);
            });

            client.on('spawn', () => {
                resolve({ success: true });
            });

            client.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Client closed with code: ${code}`));
                }
            });
        });
    } catch (error) {
        console.error('Start client error:', error);
        throw error;
    }
});

// Browse butonları için IPC handlers
ipcMain.handle('select-install-path', async () => {
    console.log('Select install path handler called');
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Installation Directory'
        });
        
        console.log('Dialog result:', result);
        return { success: !result.canceled, path: result.filePaths[0] };
    } catch (error) {
        console.error('Dialog error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-client-path', async () => {
    console.log('Select client path handler called');
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Executable', extensions: ['exe'] }],
            title: 'Select UO Client'
        });
        
        console.log('Dialog result:', result);
        return { success: !result.canceled, path: result.filePaths[0] };
    } catch (error) {
        console.error('Dialog error:', error);
        return { success: false, error: error.message };
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

// Test için mock config oluştur
async function createMockConfig() {
    const mockConfig = {
        clientPath: '/Users/batu/Desktop/UOTest/client.exe',
        currentVersion: '1.0.1',
        isInstalled: true,
        installPath: '/Users/batu/Desktop/UOTest',
        settings: {
            resolution: '1024x768',
            fps: '60',
            masterVolume: 100,
            musicVolume: 80,
            effectsVolume: 90,
            autoUpdate: true,
            launchStartup: false
        }
    };

    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    
    // Config dosyasını oluştur
    await fsPromises.writeFile(configPath, JSON.stringify(mockConfig, null, 2));
    console.log('Created mock config at:', configPath);
    return mockConfig;
}

function loadConfig() {
    try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        
        console.log('Loading config from:', configPath);
        
        if (fs.existsSync(configPath)) {
            const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            // Varsayılan değerler ile kaydedilmiş değerleri birleştir
            config = { ...defaults, ...loadedConfig };
            console.log('Loaded existing config:', config);
        } else {
            // Config dosyası yoksa varsayılan değerleri kullan
            config = { ...defaults };
            // Config dosyasını oluştur
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('Created new config with defaults:', config);
        }
        
        return config;
    } catch (error) {
        console.error('Error loading config:', error);
        config = { ...defaults };
        return config;
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

// Patch indirme fonksiyonu
async function downloadPatch(url, targetPath, progressCallback) {
    try {
        console.log('Downloading patch from:', url, 'to:', targetPath);
        
        return new Promise((resolve, reject) => {
            const request = net.request({
                method: 'GET',
                url: url
            });
            
            let data = [];
            let receivedBytes = 0;
            let totalBytes = 0;
            
            request.on('response', (response) => {
                console.log('Response headers:', response.headers);
                totalBytes = parseInt(response.headers['content-length'] || 0);
                
                response.on('data', (chunk) => {
                    data.push(chunk);
                    receivedBytes += chunk.length;
                    
                    if (totalBytes > 0) {
                        const progress = (receivedBytes / totalBytes) * 100;
                        progressCallback(Math.round(progress));
                    }
                });
                
                response.on('end', async () => {
                    try {
                        console.log('Download completed');
                        const buffer = Buffer.concat(data);
                        await fs.promises.writeFile(targetPath, buffer);
                        console.log('File saved to:', targetPath);
                        resolve();
                    } catch (error) {
                        console.error('Error saving file:', error);
                        reject(error);
                    }
                });
            });
            
            request.on('error', (error) => {
                console.error('Request error:', error);
                reject(error);
            });
            
            request.end();
        });
    } catch (error) {
        console.error('Download patch error:', error);
        throw error;
    }
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

// IPC handlers ekle
ipcMain.handle('get-client-info', async () => {
    return await installer.getClientInfo();
});

ipcMain.handle('start-installation', async (event, installPath) => {
    try {
        console.log('Starting installation...');
        const installResult = await installer.install(installPath, (phase, file, progress) => {
            event.sender.send('installation-progress', { phase, file, progress });
        });
        
        console.log('Installation completed:', installResult);
        
        // Config'i güncelle
        config = {
            ...config,
            clientPath: installResult.clientPath,
            installPath: installResult.installPath,
            isInstalled: true,
            currentVersion: installResult.currentVersion
        };
        
        // Config'i kaydet
        saveConfig();
        console.log('Updated config:', config);
        
        // UI'ı güncelle
        event.sender.send('client-version', config.currentVersion);
        event.sender.send('installation-path-changed', config.installPath);  // Yeni event ekle
        
        // Version kontrolünü yap
        const versionInfo = await checkVersion();
        event.sender.send('update-status', {
            status: versionInfo.needsUpdate ? 'Update available' : 'Client is up to date',
            needsUpdate: versionInfo.needsUpdate,
            currentVersion: config.currentVersion,
            serverVersion: versionInfo.serverVersion
        });
        
        return { success: true };
    } catch (error) {
        console.error('Installation error:', error);
        return { success: false, error: error.message };
    }
});

// Test için mock dosyaları oluşturalım
async function createMockClientFiles() {
    if (process.env.NODE_ENV === 'development') {
        const mockPath = path.join(__dirname, '../../server/full-client/files');
        await fsPromises.mkdir(mockPath, { recursive: true });
        
        // Mock client.exe
        const clientPath = path.join(mockPath, 'client.exe');
        if (!fs.existsSync(clientPath)) {
            await fsPromises.writeFile(clientPath, 'Mock client file');
        }
        
        // Mock data.uop
        const dataPath = path.join(mockPath, 'data.uop');
        if (!fs.existsSync(dataPath)) {
            await fsPromises.writeFile(dataPath, 'Mock data file');
        }
    }
}

// Development modunda test dosyalarını oluştur
if (process.env.NODE_ENV === 'development') {
    createMockClientFiles();
}

// Client path kaydetme handler'ı
ipcMain.handle('save-client-path', async (event, path) => {
    try {
        config.clientPath = path;
        CLIENT_PATH = path;
        saveConfig();
        return { success: true };
    } catch (error) {
        console.error('Error saving client path:', error);
        return { success: false, error: error.message };
    }
});

// Oyun durumunu kontrol et
ipcMain.handle('check-game-status', () => {
    try {
        // Config'den kurulum durumunu kontrol et
        const isInstalled = config.isInstalled && config.installPath && fs.existsSync(config.installPath);
        
        return {
            isInstalled: isInstalled,
            installPath: config.installPath || null
        };
    } catch (error) {
        console.error('Error checking game status:', error);
        return {
            isInstalled: false,
            error: error.message
        };
    }
});

// Update başlatma handler'ı
ipcMain.handle('start-update', async () => {
    try {
        console.log('Starting update process...');
        const versionCheck = await checkVersion();
        console.log('Version check result:', versionCheck);

        if (versionCheck.needsUpdate) {
            const patch = versionCheck.patches[0];
            console.log('Downloading patch:', patch);

            const patchDir = path.join(app.getPath('userData'), 'patches');
            await fsPromises.mkdir(patchDir, { recursive: true });
            
            const patchPath = path.join(patchDir, `patch-${versionCheck.serverVersion}.zip`);
            console.log('Patch will be saved to:', patchPath);
            
            mainWindow.webContents.send('update-status', {
                status: 'Downloading update...',
                needsUpdate: true
            });
            
            await downloadPatch(patch.url, patchPath, (progress) => {
                console.log('Download progress:', progress);
                mainWindow.webContents.send('download-progress', progress);
            });
            
            console.log('Download completed, installing patch...');
            await installPatch(patchPath, config.installPath);
            
            // Version dosyasını AppData'da güncelle
            const userDataPath = app.getPath('userData');
            const newVersionInfo = {
                version: versionCheck.serverVersion,
                updateDate: new Date().toISOString()
            };
            
            await fs.promises.writeFile(
                path.join(userDataPath, 'version.json'),
                JSON.stringify(newVersionInfo, null, 2)
            );

            // UI'ı güncelle
            mainWindow.webContents.send('client-version', newVersionInfo.version);
            mainWindow.webContents.send('update-status', {
                status: 'Update completed!',
                needsUpdate: false,
                currentVersion: newVersionInfo.version,
                serverVersion: versionCheck.serverVersion
            });
            
            return { success: true };
        }
        return { success: true, message: 'Already up to date' };
    } catch (error) {
        console.error('Update error:', error);
        throw error;
    }
});

// Dosya doğrulama handler'ı
ipcMain.handle('verify-files', async () => {
    try {
        console.log('Starting file verification...');
        const response = await fetch('http://127.0.0.1:3000/api/client-manifest');
        const manifest = await response.json();
        console.log('Received manifest:', manifest);
        
        const installPath = config.installPath;
        console.log('Install path:', installPath);
        
        let missingFiles = [];
        let corruptedFiles = [];
        
        // Tüm dosyaları kontrol et
        for (const file of manifest.files) {
            const filePath = path.join(installPath, file.path);
            console.log(`Checking file: ${file.path}`);
            console.log(`Expected size: ${file.size}`);
            
            // Dosya var mı kontrol et
            if (!fs.existsSync(filePath)) {
                console.log(`File missing: ${file.path}`);
                if (file.required) {
                    missingFiles.push(file.path);
                }
                continue;
            }
            
            // Dosya boyutu doğru mu kontrol et
            const stats = await fs.promises.stat(filePath);
            console.log(`Actual size: ${stats.size}`);
            
            if (stats.size !== file.size) {
                console.log(`File corrupted: ${file.path} (size mismatch)`);
                corruptedFiles.push(file.path);
                continue;
            }
        }
        
        // Eksik veya bozuk dosya varsa
        if (missingFiles.length > 0 || corruptedFiles.length > 0) {
            // Her dosyayı indir
            for (const file of [...missingFiles, ...corruptedFiles]) {
                mainWindow.webContents.send('verify-status', {
                    status: `Downloading: ${file}`,
                    progress: 0
                });
                
                // Dosyayı indir
                const response = await fetch(`http://127.0.0.1:3000/api/download-file/${file}`);
                const buffer = await response.arrayBuffer();
                
                // Klasör yapısını oluştur
                const fileDir = path.dirname(path.join(installPath, file));
                await fs.promises.mkdir(fileDir, { recursive: true });
                
                // Dosyayı kaydet
                await fs.promises.writeFile(path.join(installPath, file), Buffer.from(buffer));
                
                mainWindow.webContents.send('verify-status', {
                    status: `Downloaded: ${file}`,
                    progress: 100
                });
            }
            
            return {
                success: true,
                fixed: true,
                message: `Fixed ${missingFiles.length + corruptedFiles.length} files`
            };
        }
        
        return {
            success: true,
            fixed: false,
            message: 'All files are valid'
        };
    } catch (error) {
        console.error('Verify files error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// IPC Handlers
ipcMain.handle('get-install-path', () => {
    // Config'i direkt olarak kullan
    return config.installPath || '';
});

ipcMain.handle('check-server-status', async () => {
    try {
        // Burada gerçek server kontrolü yapılabilir
        // Şimdilik dummy response
        return true;
    } catch (error) {
        console.error('Server status check failed:', error);
        return false;
    }
});