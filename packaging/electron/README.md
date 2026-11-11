# Electron spike

This shell runs the whole desktop stack locally:

1. Electron picks free ports.
2. It starts the frozen Python analyzer on `127.0.0.1` with a random token.
3. It starts the bundled Express server in-process. The server serves the built
   web app and exposes `/api`, and it talks to the analyzer with the token.
4. It waits for `/api/health` to report the analyzer as healthy.
5. It opens the app from `http://127.0.0.1:<server port>`.

The token is generated on every launch and is never exposed to the renderer. The
analyzer rejects `/analyze` requests without it, so a random local web page
cannot drive the analyzer even if it guesses the port.

## Build and run (Linux)

```bash
# 1. Build the web app
pnpm --filter @chordifree/web build

# 2. Build the server bundle and install Electron
cd packaging/electron
pnpm install --ignore-workspace
pnpm build:server

# 3. Start (analyzer built as described in ../analyzer/README.md)
CHORDIFREE_ANALYZER=/absolute/path/to/dist/analyzer/analyzer pnpm start
```

On Windows the analyzer binary is `analyzer.exe` inside the
`chordifree-analyzer-windows` artifact.

## Build the Windows installer

The `Windows analyzer spike` workflow builds the analyzer and then the NSIS
installer in the same run:

1. `windows-analyzer` builds the Essentia wheel and freezes the analyzer.
2. `windows-installer` downloads that artifact, builds the web app and the
   server bundle, stages `resources/` and runs `electron-builder`.

Download the `chordifree-windows-installer` artifact. It is unsigned for now, so
Windows SmartScreen will warn on first launch.

To build the installer locally on Windows:

```bash
pnpm --filter @chordifree/web build
cd packaging/electron
pnpm install --ignore-workspace
pnpm dist:win
```

`dist:win` builds the server bundle, stages `resources/` and writes the installer
to `release/`.

## What gets bundled

```
resources/
  analyzer/   analyzer.exe, _internal/ (DLLs and ONNX models)
  web/        built web app
  server/     server.mjs
  media/      ffmpeg.exe, ffprobe.exe
```

## Environment overrides

| Variable | Purpose |
|---|---|
| `CHORDIFREE_ANALYZER` | Path to the analyzer binary. |
| `CHORDIFREE_ANALYZER_DIR` | Analyzer directory used by `prepare-resources.mjs`. |
| `CHORDIFREE_WEB_DIST` | Path to the built web app (defaults to `apps/web/dist`). |
| `CHORDIFREE_URL` | Development escape hatch: load this URL instead of the local server. |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Override the bundled media binaries. |

`ffmpeg-static` and `ffprobe-static` provide the media binaries for uploads and
YouTube jobs.

## Still missing

- Code signing, notarization and auto-updates.
- A Windows smoke test that launches the installed app, not only the analyzer.
- Default the desktop UI to audio uploads and keep YouTube in an advanced
  section, to reduce legal risk.
