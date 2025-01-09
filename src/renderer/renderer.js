const { ipcRenderer } = require('electron')

// UI Elements
const startClientBtn = document.getElementById('start-client');
const clientPathInput = document.getElementById('client-path');
const browseClientBtn = document.getElementById('browse-client');
const pathStatusEl = document.getElementById('path-status');
const updateStatusEl = document.getElementById('update-status');
const progressBar = document.querySelector('.progress');

// Event Listeners
startClientBtn.addEventListener('click', async () => {
    if (startClientBtn.textContent === 'Update Game') {
        await handleUpdate();
    } else {
        startClient();
    }
});

if (browseClientBtn) {
    browseClientBtn.addEventListener('click', selectClientPath);
}

// Functions
async function startClient() {
    startClientBtn.disabled = true;
    ipcRenderer.send('start-client');
}

async function selectClientPath() {
    ipcRenderer.send('select-client-path');
}

async function handleUpdate() {
    try {
        startClientBtn.disabled = true;
        updateStatusEl.textContent = 'Updating client...';
        ipcRenderer.send('start-update');
    } catch (error) {
        updateStatusEl.textContent = 'Update failed: ' + error.message;
        startClientBtn.disabled = false;
    }
}

// Version check
async function checkVersion() {
    updateStatusEl.textContent = 'Checking for updates...';
    ipcRenderer.send('check-updates');
}

// IPC Listeners
ipcRenderer.on('client-version', (event, version) => {
    document.getElementById('client-version').textContent = version;
});

ipcRenderer.on('update-status', (event, {status, needsUpdate}) => {
    updateStatusEl.textContent = status;
    
    if (needsUpdate) {
        startClientBtn.textContent = 'Update Game';
        startClientBtn.classList.add('update-needed');
    } else {
        startClientBtn.textContent = 'Enter Sosaria';
        startClientBtn.classList.remove('update-needed');
    }
    startClientBtn.disabled = false;
});

ipcRenderer.on('update-completed', () => {
    startClientBtn.textContent = 'Enter Sosaria';
    startClientBtn.classList.remove('update-needed');
    startClientBtn.disabled = false;
    checkVersion();
});

ipcRenderer.on('download-progress', (event, progress) => {
    progressBar.style.width = `${progress}%`;
});

ipcRenderer.on('selected-client-path', (event, path) => {
    clientPathInput.value = path;
});

ipcRenderer.on('path-status', (event, {status, message}) => {
    pathStatusEl.textContent = message;
    pathStatusEl.className = `status-text ${status}`;
});

// Sayfa geçişleri için
document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Aktif link stilini güncelle
        document.querySelector('.sidebar nav a.active').classList.remove('active');
        link.classList.add('active');
        
        // Sayfaları güncelle
        const targetPage = link.dataset.page;
        document.querySelectorAll('.page').forEach(page => {
            if (page.id === targetPage) {
                page.classList.add('active');
                page.style.display = 'block';
            } else {
                page.classList.remove('active');
                page.style.display = 'none';
            }
        });
    });
});

// Version history yükleme
async function loadVersionHistory() {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/version-history');
        const data = await response.json();
        
        const versionList = document.querySelector('.version-list');
        versionList.innerHTML = '';
        
        data.versions.forEach(version => {
            const versionItem = document.createElement('div');
            versionItem.className = 'version-item';
            
            versionItem.innerHTML = `
                <div class="version-header">
                    <span class="version-number">Version ${version.version}</span>
                    <span class="version-date">${version.date}</span>
                </div>
                <ul class="version-changes">
                    ${version.changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
            `;
            
            versionList.appendChild(versionItem);
        });
    } catch (error) {
        console.error('Error loading version history:', error);
    }
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    loadVersionHistory();
    checkVersion();
});