const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync, openSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');

let analyzer = null;
let window = null;
let analyzerUrl = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The sidecar is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Analyzer did not become healthy at ${url}`);
}

function analyzerBinary() {
  if (process.env.CHORDIFREE_ANALYZER) return process.env.CHORDIFREE_ANALYZER;
  const name = process.platform === 'win32' ? 'analyzer.exe' : 'analyzer';
  return path.join(__dirname, '..', '..', 'dist', 'analyzer', name);
}

async function startAnalyzer() {
  const binary = analyzerBinary();
  if (!existsSync(binary)) {
    throw new Error(`Analyzer binary not found: ${binary}`);
  }
  const port = await freePort();
  analyzerUrl = `http://127.0.0.1:${port}`;
  const log = openSync(path.join(app.getPath('userData'), 'analyzer.log'), 'a');
  analyzer = spawn(binary, [], {
    env: {
      ...process.env,
      ANALYZER_PORT: String(port),
      ANALYZER_DOWNLOAD_MODELS: '0',
    },
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  analyzer.once('exit', (code) => {
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox('Analyzer stopped', `The local analyzer exited with code ${code}.`);
    }
  });
  await waitForHealth(analyzerUrl);
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f6f7f9',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  const target = process.env.CHORDIFREE_URL || 'http://localhost:5173';
  void window.loadURL(target);
  window.on('closed', () => {
    window = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startAnalyzer();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Chordifree could not start', String(error));
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  analyzer?.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (window === null) createWindow();
});
