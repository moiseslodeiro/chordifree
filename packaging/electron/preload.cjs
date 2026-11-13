const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chordifreeDesktop', {
  isDesktop: true,
  platform: process.platform,
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
