const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('chordifreeDesktop', {
  isDesktop: true,
  platform: process.platform,
});
