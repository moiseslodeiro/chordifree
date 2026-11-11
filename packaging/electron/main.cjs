const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { existsSync, mkdirSync, openSync, appendFileSync, readFileSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let analyzer = null;
let window = null;
let serverUrl = null;
const isSmokeTest = process.argv.includes('--smoke-test');

function logSmoke(message) {
  console.log(message);
  if (!process.env.CHORDIFREE_SMOKE_LOG) return;
  try {
    appendFileSync(process.env.CHORDIFREE_SMOKE_LOG, `${message}\n`);
  } catch {
    // Logging is best effort.
  }
}

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

async function waitForUrl(url, predicate = () => true, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = await response.json().catch(() => null);
        if (predicate(body)) return body;
      }
    } catch {
      // The service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Service did not become healthy at ${url}`);
}

function packagedResource(...parts) {
  return path.join(process.resourcesPath, ...parts);
}

function analyzerBinary() {
  if (process.env.CHORDIFREE_ANALYZER) return process.env.CHORDIFREE_ANALYZER;
  const name = process.platform === 'win32' ? 'analyzer.exe' : 'analyzer';
  if (app.isPackaged) return packagedResource('analyzer', name);
  return path.join(__dirname, '..', '..', 'dist', 'analyzer', name);
}

function bundledPath(packageName, key) {
  try {
    const value = require(packageName);
    const resolved = key ? value?.[key] : value;
    if (typeof resolved === 'string' && resolved) return resolved;
  } catch {
    // Fall back to the system binary.
  }
  return null;
}

function mediaPath(envName, packageName, key, fallback) {
  if (process.env[envName]) return process.env[envName];
  if (app.isPackaged) {
    const name = `${fallback}${process.platform === 'win32' ? '.exe' : ''}`;
    const bundled = packagedResource('media', name);
    if (existsSync(bundled)) return bundled;
  }
  return bundledPath(packageName, key) ?? fallback;
}

async function startAnalyzer(token) {
  const binary = analyzerBinary();
  if (!existsSync(binary)) {
    throw new Error(`Analyzer binary not found: ${binary}`);
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const log = openSync(path.join(app.getPath('userData'), 'analyzer.log'), 'a');
  analyzer = spawn(binary, [], {
    env: {
      ...process.env,
      ANALYZER_PORT: String(port),
      ANALYZER_DOWNLOAD_MODELS: '0',
      ANALYZER_TOKEN: token,
    },
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  analyzer.once('exit', (code) => {
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox('Analyzer stopped', `The local analyzer exited with code ${code}.`);
    }
  });
  await waitForUrl(`${url}/health`, () => true, 60_000);
  return url;
}

async function startServer(analyzerUrl, token) {
  const serverEntry = app.isPackaged
    ? packagedResource('server', 'server.mjs')
    : path.join(__dirname, 'dist', 'server.mjs');
  if (!existsSync(serverEntry)) {
    throw new Error(
      `Server bundle not found: ${serverEntry}. Run "pnpm build:server" and "pnpm resources".`,
    );
  }

  const webDist =
    process.env.CHORDIFREE_WEB_DIST ??
    (app.isPackaged
      ? packagedResource('web')
      : path.join(__dirname, '..', '..', 'apps', 'web', 'dist'));
  if (!existsSync(webDist)) {
    throw new Error(`Web build not found: ${webDist}. Run "pnpm --filter @chordifree/web build".`);
  }

  const port = await freePort();
  const tempDir = path.join(app.getPath('userData'), 'tmp');
  mkdirSync(tempDir, { recursive: true });

  Object.assign(process.env, {
    HOST: '127.0.0.1',
    PORT: String(port),
    ANALYZER_URL: analyzerUrl,
    ANALYZER_TOKEN: token,
    WEB_DIST: webDist,
    TEMP_DIR: tempDir,
    CORS_ORIGIN: `http://127.0.0.1:${port}`,
    TRUST_PROXY: '0',
    RATE_LIMIT_MAX: '1000',
    FFMPEG_PATH: mediaPath('FFMPEG_PATH', 'ffmpeg-static', null, 'ffmpeg'),
    FFPROBE_PATH: mediaPath('FFPROBE_PATH', 'ffprobe-static', 'path', 'ffprobe'),
  });

  await import(pathToFileURL(serverEntry).href);
  await waitForUrl(`http://127.0.0.1:${port}/api/health`, (body) => body?.analyzer === 'ok');

  return `http://127.0.0.1:${port}`;
}

function smokeFixture() {
  if (process.env.CHORDIFREE_SMOKE_FIXTURE) return process.env.CHORDIFREE_SMOKE_FIXTURE;
  const candidate = app.isPackaged
    ? packagedResource('smoke', 'fixture.wav')
    : path.join(__dirname, '..', '..', 'scripts', 'fixtures', 'chords.wav');
  return existsSync(candidate) ? candidate : null;
}

async function runSmokeTest(target) {
  const healthResponse = await fetch(`${target}/api/health`);
  const health = await healthResponse.json();
  logSmoke(`health: analyzer=${health.analyzer} version=${health.analyzerVersion}`);
  if (!healthResponse.ok || health.analyzer !== 'ok') {
    throw new Error('The bundled analyzer is not healthy');
  }

  const fixture = smokeFixture();
  if (!fixture) {
    logSmoke('no fixture found; health-only smoke test');
    return;
  }

  const form = new FormData();
  form.append('file', new Blob([readFileSync(fixture)], { type: 'audio/wav' }), 'fixture.wav');
  const createdResponse = await fetch(`${target}/api/analyses`, { method: 'POST', body: form });
  if (!createdResponse.ok) {
    throw new Error(`Could not create the smoke analysis (${createdResponse.status})`);
  }
  const created = await createdResponse.json();
  logSmoke(`analysis job: ${created.id}`);

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const view = await (await fetch(`${target}/api/analyses/${created.id}`)).json();
    if (view.status === 'done') {
      const chords = view.result.segments.filter((segment) => segment.chord).length;
      logSmoke(
        `analysis done: ${view.result.segments.length} segments, ${chords} chords, ${view.result.beats.length} beats`,
      );
      if (chords === 0) throw new Error('The smoke analysis returned no chords');
      return;
    }
    if (view.status === 'error') {
      throw new Error(`The smoke analysis failed: ${JSON.stringify(view.error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('The smoke analysis timed out');
}

function createWindow(target) {
  const icon = app.isPackaged
    ? packagedResource('icon.png')
    : path.join(__dirname, 'assets', 'icon.png');
  window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f6f7f9',
    ...(existsSync(icon) ? { icon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  void window.loadURL(target);
  window.on('closed', () => {
    window = null;
  });
}

app.setName('Chordifree');
if (process.platform === 'win32') app.setAppUserModelId('app.chordifree.desktop');

app.whenReady().then(async () => {
  const token = randomBytes(32).toString('hex');
  try {
    const analyzerUrl = await startAnalyzer(token);
    serverUrl = await startServer(analyzerUrl, token);

    if (isSmokeTest) {
      await runSmokeTest(serverUrl);
      logSmoke('smoke-test ok');
      analyzer?.kill();
      app.exit(0);
      return;
    }

    createWindow(process.env.CHORDIFREE_URL || serverUrl);
  } catch (error) {
    if (isSmokeTest) {
      logSmoke(`smoke-test failed: ${error?.stack ?? error}`);
      analyzer?.kill();
      app.exit(1);
      return;
    }
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
  if (window === null && serverUrl) createWindow(serverUrl);
});
