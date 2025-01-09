// Browse butonları için direkt event listener'lar
document.addEventListener('DOMContentLoaded', () => {
    console.log('Installer UI: DOM loaded');

    // UI Elements
    const elements = {
        browseInstallBtn: document.getElementById('browse-install'),
        installPathInput: document.getElementById('install-path'),
        browseClientBtn: document.getElementById('browse-client'),
        clientPathInput: document.getElementById('client-path'),
        installButton: document.getElementById('start-install'),
        installStatus: document.getElementById('install-status'),
        progressBar: document.getElementById('install-progress'),
        progressText: document.getElementById('progress-text'),
        requiredSpace: document.getElementById('required-space'),
        currentPhase: document.getElementById('current-phase')
    };

    // Client info'yu al
    async function checkInstallation() {
        try {
            const clientInfo = await window.ipcRenderer.invoke('get-client-info');
            if (elements.requiredSpace) {
                elements.requiredSpace.textContent = formatBytes(clientInfo.requiredSpace);
            }
            if (elements.installStatus) {
                elements.installStatus.textContent = 'Ready to install';
            }
        } catch (error) {
            console.error('Installation check error:', error);
            if (elements.installStatus) {
                elements.installStatus.textContent = 'Error checking installation';
            }
        }
    }

    // Boyut formatla
    function formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    // Install progress listener
    window.ipcRenderer.on('installation-progress', (event, { phase, file, progress }) => {
        console.log('Installation progress:', phase, file, progress);
        if (elements.currentPhase) {
            elements.currentPhase.textContent = `${phase}: ${file}`;
        }
        if (elements.progressBar) {
            elements.progressBar.style.width = `${progress}%`;
        }
        if (elements.progressText) {
            elements.progressText.textContent = `${Math.round(progress)}%`;
        }
    });

    // Browse Install Button
    if (elements.browseInstallBtn) {
        console.log('Found browse install button');
        elements.browseInstallBtn.addEventListener('click', async () => {
            console.log('Browse install clicked');
            try {
                const result = await window.ipcRenderer.invoke('select-install-path');
                console.log('Got install path:', result);
                
                if (result.success && elements.installPathInput) {
                    elements.installPathInput.value = result.path;
                    if (elements.installButton) {
                        elements.installButton.disabled = false;
                    }
                }
            } catch (error) {
                console.error('Browse install error:', error);
            }
        });
    }

    // Install Button
    if (elements.installButton) {
        elements.installButton.addEventListener('click', async () => {
            console.log('Install button clicked');
            try {
                if (!elements.installPathInput.value) {
                    alert('Please select installation directory first');
                    return;
                }

                elements.installButton.disabled = true;
                elements.installStatus.textContent = 'Installing...';

                const result = await window.ipcRenderer.invoke('start-installation', elements.installPathInput.value);
                
                if (result.success) {
                    elements.installStatus.textContent = 'Installation completed successfully!';
                } else {
                    elements.installStatus.textContent = `Installation failed: ${result.error}`;
                    elements.installButton.disabled = false;
                }
            } catch (error) {
                console.error('Installation error:', error);
                elements.installStatus.textContent = 'Installation failed';
                elements.installButton.disabled = false;
            }
        });
    }

    // Browse Client Button
    if (elements.browseClientBtn) {
        console.log('Found browse client button');
        elements.browseClientBtn.addEventListener('click', async () => {
            console.log('Browse client clicked');
            try {
                const result = await window.ipcRenderer.invoke('select-client-path');
                console.log('Got client path:', result);
                
                if (result.success && elements.clientPathInput) {
                    elements.clientPathInput.value = result.path;
                    await window.ipcRenderer.invoke('save-client-path', result.path);
                }
            } catch (error) {
                console.error('Browse client error:', error);
            }
        });
    }

    // İlk yüklemede client info'yu al
    checkInstallation();
}); 