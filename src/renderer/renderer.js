const { ipcRenderer } = require('electron')

// UI Elements
const clientVersionEl = document.getElementById('client-version');
const updateStatusEl = document.getElementById('update-status');
const progressBar = document.querySelector('.progress');
const startClientBtn = document.getElementById('start-client');
const clientPathInput = document.getElementById('client-path');
const browseClientBtn = document.getElementById('browse-client');
const pathStatusEl = document.getElementById('path-status');

// Event Listeners
startClientBtn.addEventListener('click', async () => {
    if (startClientBtn.textContent === 'Update Game') {
        await handleUpdate();
    } else {
        startClient();
    }
});

browseClientBtn.addEventListener('click', selectClientPath);

// Functions
async function checkForUpdates() {
    updateStatusEl.textContent = 'Checking for updates...';
    ipcRenderer.send('check-updates');
}

async function startClient() {
    startClientBtn.disabled = true;
    ipcRenderer.send('start-client');
}

async function selectClientPath() {
    ipcRenderer.send('select-client-path');
}

// IPC Listeners
ipcRenderer.on('client-version', (event, version) => {
    clientVersionEl.textContent = version;
    loadVersionHistory();
});

ipcRenderer.on('update-status', (event, {status, needsUpdate}) => {
    updateStatusEl.textContent = status;
    
    if (needsUpdate) {
        // If update is needed, update the button
        startClientBtn.textContent = 'Update Game';
        startClientBtn.classList.add('update');
        startClientBtn.disabled = false;
    } else {
        // If no update needed, show normal button
        startClientBtn.textContent = 'Start Game';
        startClientBtn.classList.remove('update');
        startClientBtn.disabled = !clientPathInput.value;
    }
});

ipcRenderer.on('download-progress', (event, progress) => {
    progressBar.style.width = `${progress}%`;
});

ipcRenderer.on('client-closed', () => {
    startClientBtn.disabled = false;
});

ipcRenderer.on('selected-client-path', (event, path) => {
    clientPathInput.value = path;
});

ipcRenderer.on('path-status', (event, {status, message}) => {
    pathStatusEl.textContent = message;
    pathStatusEl.className = `status-text ${status}`;
    startClientBtn.disabled = status !== 'success';
});

ipcRenderer.on('update-completed', () => {
    startClientBtn.textContent = 'Start Game';
    startClientBtn.classList.remove('update');
    startClientBtn.disabled = false;
    checkInitialVersion();
});

// Version history functions
async function loadVersionHistory() {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/version-history');
        const data = await response.json();
        
        console.log('Version history data:', data);
        
        const versionList = document.querySelector('.version-list');
        versionList.innerHTML = '';
        
        data.versions.forEach(version => {
            const isCurrentVersion = version.version === clientVersionEl.textContent;
            console.log('Comparing versions:', version.version, clientVersionEl.textContent);
            
            const versionItem = document.createElement('div');
            versionItem.className = `version-item ${isCurrentVersion ? 'current-version' : ''}`;
            
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

// Initial setup
startClientBtn.disabled = !clientPathInput.value;

async function checkInitialVersion() {
    startClientBtn.disabled = true;
    updateStatusEl.textContent = 'Checking for updates...';
    ipcRenderer.send('check-updates');
}

// Sayfa yüklendiğinde version kontrolü ve history yükleme
document.addEventListener('DOMContentLoaded', () => {
    checkInitialVersion();
    loadVersionHistory();
});

// Update işlemi
async function handleUpdate() {
    try {
        startClientBtn.disabled = true;
        updateStatusEl.textContent = 'Updating client...';
        
        // Start update process
        ipcRenderer.send('start-update');
    } catch (error) {
        updateStatusEl.textContent = 'Update failed: ' + error.message;
        startClientBtn.disabled = false;
    }
} 