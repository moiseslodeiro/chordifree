import { access, cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

const webDist = process.env.CHORDIFREE_WEB_DIST ?? path.join(repo, 'apps/web/dist');
const analyzerDir = process.env.CHORDIFREE_ANALYZER_DIR ?? path.join(repo, 'dist/analyzer');
const serverBundle = path.join(here, 'dist/server.mjs');
const output = path.join(here, 'resources');

async function ensure(target, label) {
  try {
    await access(target);
  } catch {
    throw new Error(`${label} not found: ${target}`);
  }
}

function mediaBinaries() {
  const binaries = [];
  try {
    const ffmpeg = require('ffmpeg-static');
    if (ffmpeg) binaries.push(['ffmpeg', ffmpeg]);
  } catch {
    // Optional: the app falls back to ffmpeg on PATH.
  }
  try {
    const ffprobe = require('ffprobe-static');
    if (typeof ffprobe?.path === 'string') binaries.push(['ffprobe', ffprobe.path]);
  } catch {
    // Optional: the app falls back to ffprobe on PATH.
  }
  return binaries;
}

await ensure(webDist, 'Web build');
await ensure(analyzerDir, 'Analyzer bundle');
await ensure(serverBundle, 'Server bundle');

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'server'), { recursive: true });
await mkdir(path.join(output, 'media'), { recursive: true });

await cp(webDist, path.join(output, 'web'), { recursive: true });
// PyInstaller relies on relative symlinks (especially Python.framework on
// macOS). Node rewrites them to absolute source paths unless verbatimSymlinks
// is set, which breaks codesign and makes the bundle non-relocatable.
await cp(analyzerDir, path.join(output, 'analyzer'), {
  recursive: true,
  verbatimSymlinks: true,
});
await cp(serverBundle, path.join(output, 'server', 'server.mjs'));
await cp(path.join(here, 'assets', 'icon.png'), path.join(output, 'icon.png'));

for (const [name, source] of mediaBinaries()) {
  const target = path.join(output, 'media', `${name}${path.extname(source)}`);
  await cp(source, target);
  console.log(`media: ${name} <- ${source}`);
}

console.log(`Resources prepared in ${output}`);
