const { ipcRenderer } = require('electron')

// UI Elements
const clientVersionEl = document.getElementById('client-version');
const updateStatusEl = document.getElementById('update-status');
const progressBar = document.querySelector('.progress');
const checkUpdateBtn = document.getElementById('check-update');
const startClientBtn = document.getElementById('start-client');

// Event Listeners
checkUpdateBtn.addEventListener('click', checkForUpdates);
startClientBtn.addEventListener('click', startClient);

// Functions
async function checkForUpdates() {
    updateStatusEl.textContent = 'Checking for updates...';
    ipcRenderer.send('check-updates');
}

async function startClient() {
    startClientBtn.disabled = true;
    ipcRenderer.send('start-client');
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