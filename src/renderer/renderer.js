const { ipcRenderer } = require('electron');
window.ipcRenderer = ipcRenderer; // Global olarak tanımla

// Boyut formatla fonksiyonu
function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// Sayfa geçişleri için
function initializePageNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const pages = document.querySelectorAll('.page');

    // İlk yüklemede sadece dashboard'u göster
    pages.forEach(page => {
        page.style.display = 'none';  // Önce hepsini gizle
    });
    document.getElementById('dashboard').style.display = 'block';  // Dashboard'u göster

    // Dashboard nav item'ını aktif yap
    document.querySelector('.nav-item[data-page="dashboard"]').classList.add('active');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.getAttribute('data-page');
            
            // Active class'ları güncelle
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Sayfaları göster/gizle
            pages.forEach(page => {
                page.style.display = page.id === targetPage ? 'block' : 'none';
            });
        });
    });
}

// Server status kontrolü
function updateServerStatus() {
    const serverStatus = document.querySelector('.server-status');
    const statusText = serverStatus.querySelector('.status-text');

    // Burada gerçek server kontrolü yapılabilir
    window.ipcRenderer.invoke('check-server-status')
        .then(isOnline => {
            if (isOnline) {
                serverStatus.classList.remove('offline');
                statusText.textContent = 'Server Online';
            } else {
                serverStatus.classList.add('offline');
                statusText.textContent = 'Server Offline';
            }
        })
        .catch(() => {
            serverStatus.classList.add('offline');
            statusText.textContent = 'Server Offline';
        });
}

// Oyun durumunu kontrol et ve UI'ı güncelle
async function checkGameStatus() {
    try {
        const status = await window.ipcRenderer.invoke('check-game-status');
        const installInfo = document.getElementById('install-info');
        const gameInfo = document.getElementById('game-info');
        const startGameBtn = document.getElementById('start-game');
        const installGameBtn = document.getElementById('install-game');
        const installPathInput = document.getElementById('install-path');

        if (status.isInstalled) {
            if (installInfo) installInfo.style.display = 'none';
            if (gameInfo) gameInfo.style.display = 'block';
            if (startGameBtn) startGameBtn.style.display = 'block';
            if (installGameBtn) installGameBtn.style.display = 'none';
            // Installation path'i güncelle
            if (installPathInput) {
                installPathInput.value = status.installPath || 'Not set';
            }
        } else {
            if (installInfo) installInfo.style.display = 'block';
            if (gameInfo) gameInfo.style.display = 'none';
            if (startGameBtn) startGameBtn.style.display = 'none';
            if (installGameBtn) installGameBtn.style.display = 'block';
            // Installation path'i sıfırla
            if (installPathInput) {
                installPathInput.value = 'Not set';
            }
        }
    } catch (error) {
        console.error('Error checking game status:', error);
    }
}

// Install Game butonu için event listener
const installGameBtn = document.getElementById('install-game');
if (installGameBtn) {
    installGameBtn.addEventListener('click', async () => {
        try {
            const result = await window.ipcRenderer.invoke('select-install-path');
            if (result.success) {
                installGameBtn.disabled = true;
                
                // Yüklemeyi başlat
                const installResult = await window.ipcRenderer.invoke('start-installation', result.path);
                if (installResult.success) {
                    // Durumu güncelle
                    await checkGameStatus();
                } else {
                    alert(`Installation failed: ${installResult.error}`);
                }
            }
        } catch (error) {
            console.error('Installation error:', error);
            alert('Failed to install game!');
        } finally {
            installGameBtn.disabled = false;
        }
    });
}

// Version bilgisi listener'ı
window.ipcRenderer.on('client-version', (event, version) => {
    console.log('Received version:', version);
    const versionEl = document.getElementById('client-version');
    if (versionEl) {
        // Eğer version boşsa veya undefined ise 'Not Installed' göster
        versionEl.textContent = version || 'Not Installed';
        
        // Version durumuna göre renk değiştir
        if (version && version !== 'Not Installed') {
            versionEl.style.color = 'var(--text-primary)';
        } else {
            versionEl.style.color = 'var(--text-secondary)';
        }
    }
});

// Update status listener'ı
window.ipcRenderer.on('update-status', (event, status) => {
    console.log('Received update status:', status);
    const startGameBtn = document.getElementById('start-game');
    const statusText = document.querySelector('.installation-status .status-text');
    
    if (startGameBtn) {
        startGameBtn.disabled = false;
        
        if (status.needsUpdate) {
            startGameBtn.innerHTML = '<i class="fas fa-download"></i> Update Game';
            startGameBtn.onclick = null;
            startGameBtn.onclick = async () => {
                try {
                    startGameBtn.disabled = true;
                    console.log('Starting update...');
                    const result = await window.ipcRenderer.invoke('start-update');
                    console.log('Update result:', result);
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Update failed');
                    }
                } catch (error) {
                    console.error('Update error:', error);
                    alert('Update failed: ' + error.message);
                }
            };
            // Status text'i güncelle
            if (statusText) {
                statusText.textContent = 'Update available';
            }
        } else {
            startGameBtn.innerHTML = '<i class="fas fa-play"></i> Start Game';
            startGameBtn.onclick = null;
            startGameBtn.onclick = async () => {
                try {
                    startGameBtn.disabled = true;
                    console.log('Starting client...');
                    const result = await window.ipcRenderer.invoke('start-client');
                    console.log('Start client result:', result);
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to start game');
                    }
                } catch (error) {
                    console.error('Start game error:', error);
                    alert('Failed to start game: ' + error.message);
                } finally {
                    startGameBtn.disabled = false;
                }
            };
            // Status text'i güncelle
            if (statusText) {
                statusText.textContent = 'Client is up to date';
            }
        }
    }
});

// Installation path değişikliği listener'ı
window.ipcRenderer.on('installation-path-changed', (event, path) => {
    const installPathInput = document.getElementById('install-path');
    if (installPathInput) {
        installPathInput.value = path || 'Not set';
    }
});

// Sayfa yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer: DOM loaded');
    
    // Sayfa geçişlerini başlat
    initializePageNavigation();
    
    // Server statusu kontrol et
    updateServerStatus();
    setInterval(updateServerStatus, 30000); // Her 30 saniyede bir kontrol et

    // Start Game butonunun eski event listener'ını kaldır
    const startGameBtn = document.getElementById('start-game');
    if (startGameBtn) {
        startGameBtn.removeEventListener('click', startGameBtn.onclick);
    }

    // Installation path değiştirme
    const changePathBtn = document.getElementById('change-path');
    const installPathInput = document.getElementById('install-path');
    
    if (changePathBtn && installPathInput) {
        // Mevcut path'i göster
        window.ipcRenderer.invoke('get-install-path').then(path => {
            installPathInput.value = path || 'Not set';
        });

        changePathBtn.addEventListener('click', async () => {
            try {
                const result = await window.ipcRenderer.invoke('select-install-path');
                if (result.success) {
                    installPathInput.value = result.path;
                }
            } catch (error) {
                console.error('Change path error:', error);
                alert('Failed to change installation path!');
            }
        });
    }

    // Tema değiştirme
    const themeSelect = document.getElementById('theme');
    if (themeSelect) {
        // Kaydedilmiş temayı yükle
        const savedTheme = localStorage.getItem('theme') || 'default';
        themeSelect.value = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);

        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }

    // Resolution ve Fullscreen ayarları
    const resolutionSelect = document.getElementById('resolution');
    const fullscreenCheck = document.getElementById('fullscreen');

    if (resolutionSelect && fullscreenCheck) {
        // Kaydedilmiş ayarları yükle
        const savedResolution = localStorage.getItem('resolution') || '1920x1080';
        const savedFullscreen = localStorage.getItem('fullscreen') === 'true';

        resolutionSelect.value = savedResolution;
        fullscreenCheck.checked = savedFullscreen;

        // Değişiklikleri kaydet
        resolutionSelect.addEventListener('change', (e) => {
            localStorage.setItem('resolution', e.target.value);
        });

        fullscreenCheck.addEventListener('change', (e) => {
            localStorage.setItem('fullscreen', e.target.checked);
        });
    }

    // Repair Game butonu
    const repairGameBtn = document.getElementById('repair-game');
    if (repairGameBtn) {
        repairGameBtn.addEventListener('click', async () => {
            try {
                repairGameBtn.disabled = true;
                const result = await window.ipcRenderer.invoke('verify-files');
                
                if (result.success) {
                    alert(result.fixed ? 'Game files repaired successfully!' : 'All files are valid!');
                } else {
                    alert(`Repair failed: ${result.error}`);
                }
            } catch (error) {
                console.error('Repair game error:', error);
                alert('Failed to repair game files!');
            } finally {
                repairGameBtn.disabled = false;
            }
        });
    }

    // İlk yüklemede oyun durumunu kontrol et
    checkGameStatus();
});