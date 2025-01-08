const { ipcRenderer } = require('electron')

// UI Elements
const clientVersionEl = document.getElementById('client-version');
const updateStatusEl = document.getElementById('update-status');
const progressBar = document.querySelector('.progress');
const checkUpdateBtn = document.getElementById('check-update');
const startClientBtn = document.getElementById('start-client');
const clientPathInput = document.getElementById('client-path');
const browseClientBtn = document.getElementById('browse-client');
const pathStatusEl = document.getElementById('path-status');

// Event Listeners
checkUpdateBtn.addEventListener('click', checkForUpdates);
startClientBtn.addEventListener('click', startClient);
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
});

ipcRenderer.on('update-status', (event, status) => {
    updateStatusEl.textContent = status;
    if (status.includes('Error')) {
        startClientBtn.disabled = false;
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

// Initial setup
startClientBtn.disabled = !clientPathInput.value; 