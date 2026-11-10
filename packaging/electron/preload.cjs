const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('chordifreeDesktop', {
  platform: process.platform,
});
