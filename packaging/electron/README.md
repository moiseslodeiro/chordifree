# Electron spike

This is a development spike, not the final desktop package. It proves the local
sidecar lifecycle:

1. Electron picks a free port.
2. It starts the frozen Python analyzer on `127.0.0.1`.
3. It waits for `/health`.
4. It opens the web app.

## Try it

```bash
# Terminal 1: web + Express dev server
pnpm dev

# Build the analyzer sidecar first (see ../analyzer)
# Terminal 2:
cd packaging/electron
pnpm install
CHORDIFREE_ANALYZER=/absolute/path/to/dist/analyzer/analyzer pnpm start
```

On Windows the binary is `dist/analyzer/analyzer.exe`.

## What is still missing for a real installer

- Bundle the Express server and the built web app so Electron does not depend on
  `pnpm dev`.
- Pass the analyzer URL to the web app (for example through the preload bridge or
  a local proxy).
- Add a local token header to the analyzer requests.
- Package with electron-builder, sign the Windows installer and macOS app, and
  configure auto-updates.
- Default the desktop build to audio uploads to reduce YouTube legal risk.
