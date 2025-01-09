const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const AdmZip = require('adm-zip');

class Installer {
    constructor() {
        this.clientInfo = null;
        this.sourceDir = path.join(__dirname, '../../server/full-client');
    }

    async downloadFullClient(installPath, progressCallback) {
        return new Promise((resolve, reject) => {
            const tempPath = path.join(app.getPath('temp'), 'full-client.zip');
            const request = net.request('http://localhost:3000/api/full-client');
            
            let data = [];
            let receivedBytes = 0;
            let totalBytes = 0;
            
            request.on('response', (response) => {
                totalBytes = parseInt(response.headers['content-length'] || 0);
                
                response.on('data', (chunk) => {
                    data.push(chunk);
                    receivedBytes += chunk.length;
                    
                    if (totalBytes > 0) {
                        const progress = (receivedBytes / totalBytes) * 100;
                        progressCallback('Downloading', 'full-client.zip', Math.round(progress));
                        // Yapay gecikme ekle
                        new Promise(resolve => setTimeout(resolve, 100));
                    }
                });
                
                response.on('end', async () => {
                    try {
                        const buffer = Buffer.concat(data);
                        await fs.promises.writeFile(tempPath, buffer);
                        resolve(tempPath);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            request.on('error', (error) => {
                reject(error);
            });
            
            request.end();
        });
    }

    async copyFiles(installPath) {
        try {
            // source/files klasöründen dosyaları kopyala
            const sourceFilesDir = path.join(this.sourceDir, 'files');
            const files = await fs.promises.readdir(sourceFilesDir);

            for (const file of files) {
                const sourcePath = path.join(sourceFilesDir, file);
                const targetPath = path.join(installPath, file);

                // Dosya stats'larını al
                const stats = await fs.promises.stat(sourcePath);

                if (stats.isFile()) {
                    // Dosyayı kopyala
                    await fs.promises.copyFile(sourcePath, targetPath);
                    console.log(`Copied file: ${file}`);
                }
            }

            console.log('All files copied successfully');
            return true;
        } catch (error) {
            console.error('Error copying files:', error);
            throw error;
        }
    }

    async install(installPath, progressCallback) {
        try {
            console.log('Starting installation to:', installPath);
            console.log('Source directory:', this.sourceDir);
            
            // Client info al
            const clientInfo = await this.getClientInfo();
            console.log('Client info:', clientInfo);

            // Klasör oluştur
            await fs.promises.mkdir(installPath, { recursive: true });

            // Full client'ı indir
            progressCallback('Downloading', 'full-client.zip', 0);
            const zipPath = await this.downloadFullClient(installPath, progressCallback);
            progressCallback('Downloading', 'full-client.zip', 100);

            // Zip'i çıkart
            progressCallback('Installing', 'Extracting files...', 0);
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(installPath, true);
            progressCallback('Installing', 'Finalizing', 100);

            // Temp dosyayı sil
            await fs.promises.unlink(zipPath);

            // Dosyaları kopyala
            progressCallback('Installing', 'Copying files...', 0);
            await this.copyFiles(installPath);
            progressCallback('Installing', 'Finalizing...', 100);

            // info.json'u oku
            const infoPath = path.join(this.sourceDir, 'info.json');
            console.log('Reading info from:', infoPath);
            const info = JSON.parse(await fs.promises.readFile(infoPath, 'utf8'));
            console.log('Installation info:', info);

            // Version bilgisini AppData'ya kaydet
            const userDataPath = app.getPath('userData');
            const versionInfo = {
                version: '1.0.0',  // Başlangıç versiyonu
                installDate: new Date().toISOString()
            };
            
            await fs.promises.writeFile(
                path.join(userDataPath, 'version.json'),
                JSON.stringify(versionInfo, null, 2)
            );

            return {
                success: true,
                clientPath: path.join(installPath, 'client.exe'),
                installPath: installPath,
                currentVersion: versionInfo.version
            };
        } catch (error) {
            console.error('Installation error:', error);
            throw error;
        }
    }

    async getClientInfo() {
        try {
            return {
                requiredSpace: 1073741824, // 1 GB
                files: [
                    {
                        name: 'client.exe',
                        size: 524288000  // 500 MB
                    },
                    {
                        name: 'data.uop',
                        size: 524288000  // 500 MB
                    }
                ]
            };
        } catch (error) {
            console.error('Error getting client info:', error);
            throw error;
        }
    }
}

module.exports = Installer; 