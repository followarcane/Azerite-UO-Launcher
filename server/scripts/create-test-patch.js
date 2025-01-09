const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

// Test patch oluştur
async function createTestPatch() {
    const zip = new AdmZip();
    
    // Test dosyaları ekle
    zip.addFile("client.exe", Buffer.from("Test client file version 1.0.1"));
    zip.addFile("config.ini", Buffer.from("Test config file version 1.0.1"));
    
    // Patches klasörünü kontrol et
    const patchDir = path.join(__dirname, '../patches/1.0.1');
    if (!fs.existsSync(patchDir)) {
        fs.mkdirSync(patchDir, { recursive: true });
    }
    
    // Zip dosyasını kaydet
    zip.writeZip(path.join(patchDir, 'patch.zip'));
    
    console.log('Test patch created successfully!');
}

createTestPatch().catch(console.error); 