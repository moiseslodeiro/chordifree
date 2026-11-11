# Chordifree

Turn a YouTube video or your own audio file into a synchronized chord timeline you can
practice with. Chordifree estimates the key, beats, bars and chords, aligns lyrics with the
sung sections, and lets you correct everything in the browser.

![Chordifree](apps/web/public/og-image.png)

> **Legal notice**: downloading YouTube audio may violate its Terms of Service. Use the
> audio-upload option when you do not own the content. Chordifree does not bypass technical
> restrictions or use session cookies.

## Quick start with Docker

Requirements: Docker Engine or Docker Desktop with Compose v2, and an internet connection for
the first build (the analyzer downloads its ONNX models).

```bash
git clone https://github.com/moiseslodeiro/chordifree.git
cd chordifree
docker compose up --build -d
```

If your Docker installation only provides the standalone binary, use
`docker-compose up --build -d` instead. The `Makefile` detects both.

Open **http://localhost:3000**.

Useful commands:

```bash
make logs      # follow logs
make down      # stop
make up        # rebuild and start
make clean     # stop and remove volumes
```

The first build can take a few minutes because it installs Essentia, ONNX Runtime, ffmpeg,
yt-dlp and the voice-detection models. The first analysis is also slower than the rest.

### VPS with HTTPS

The Compose stack binds the web container to `127.0.0.1:3000`, so it is not exposed directly.
Put Caddy (or another reverse proxy) in front of it:

```bash
sudo apt install caddy
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
# edit the domain, then:
sudo systemctl reload caddy
```

Caddy obtains and renews the TLS certificate automatically. Open only ports 80 and 443 in the
VPS firewall; do not expose 3000, 3001 or 8000.

## Features

- **Chord detection** with Essentia `NNLSChroma`, key estimation and Viterbi smoothing.
- **Beat grid** with one row per bar, active-beat highlighting and keyboard navigation.
- **Bar view** with one chord per bar and automatic tempo/phase adjustment.
- **Lyrics view** with approximate timing, vocal-region detection and manual anchors.
- **Practice A-B**: arm A or B, hover to preview a bar, click to mark it without playing, then
  play from A to B or loop the range.
- **Transposition**, English/Spanish notation, sharps/flats, capo, guitar/piano/ukelele.
- **Simplify / reduce chords** for simpler accompaniment.
- **Local library** stored in the browser, with JSON export/import and print/PDF.
- **English and Spanish interface**, English by default.

## Local development

Requirements: Node.js 20+, pnpm 9+, Python 3.11+, ffmpeg and yt-dlp.

```bash
pnpm install
cp .env.example .env

# Terminal 1: analyzer
python3 -m venv .venv
. .venv/bin/activate
pip install -r services/analyzer/requirements.txt
uvicorn app.main:app --app-dir services/analyzer --port 8000

# Terminal 2: web + API
pnpm dev
```

Open **http://localhost:5173**.

The analyzer downloads its ONNX models on the first analysis. To prefetch them, see
[`services/analyzer/models/README.md`](services/analyzer/models/README.md). Set
`ANALYZER_DOWNLOAD_MODELS=0` in production and bake the models into the image instead.

## Configuration

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Express API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin |
| `ANALYZER_URL` | `http://localhost:8000` | Internal analyzer URL |
| `MAX_DURATION_SECONDS` | `900` | Maximum audio/video length |
| `MAX_UPLOAD_BYTES` | `26214400` | Maximum upload size (25 MB) |
| `RATE_LIMIT_MAX` | `5` | Analysis requests per window and IP |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Rate-limit window |
| `TRUST_PROXY` | `1` | Trusted reverse-proxy hops |
| `TEMP_DIR` | `./.tmp` | Temporary audio directory |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp binary |
| `FFMPEG_PATH` | `ffmpeg` | ffmpeg binary |
| `FFPROBE_PATH` | `ffprobe` | ffprobe binary |
| `ANALYZER_VERSION` | `essentia-1.6` | Cache-busting analyzer version |
| `ANALYZER_DOWNLOAD_MODELS` | `1` | Allow runtime model download |

## Architecture

```text
Browser (React + Vite)
  -> nginx / Express API
       -> FastAPI analyzer (Essentia + ONNX Runtime)
       -> yt-dlp + ffmpeg (YouTube or upload)
```

- `apps/web`: React SPA, local library, lyrics alignment, practice tools.
- `apps/server`: Express API, upload handling, YouTube download, job queue.
- `services/analyzer`: FastAPI + Essentia + NNLSChroma + YAMNet/voice ONNX models.
- `packages/chords`: chord model, notation, transposition and reduction.

The Docker Compose setup publishes **only port 3000**. The API and analyzer are reachable only
inside the Compose network.

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm -r test
pnpm --filter @chordifree/web exec playwright test
.venv/bin/python -m pytest services/analyzer/tests
```

The end-to-end suite needs Playwright browsers installed
(`pnpm --filter @chordifree/web exec playwright install`).

## Desktop app (experimental)

A local desktop build is being explored in `packaging/`:

- `packaging/analyzer`: PyInstaller spec for the FastAPI analyzer sidecar.
- `packaging/electron`: Electron shell that starts the analyzer and the bundled
  Express server on random local ports, serves the built web app and protects the
  analyzer with a per-launch token.
- `.github/workflows/windows-analyzer.yml`: builds an Essentia Windows wheel,
  freezes the analyzer with PyInstaller and smoke-tests it on Windows. The
  workflow produces `chordifree-analyzer-windows`.

The Windows spike is validated end to end (`/health`, audio analysis and the
`C/F/G` smoke test). The same workflow stages the analyzer, web app, server and
media binaries, and produces an **unsigned NSIS installer** as
`chordifree-windows-installer`. Code signing, notarization and auto-updates are
still pending. Essentia does not publish an official Windows wheel, so the
workflow builds one from the open Windows-wheel PR and applies small
compatibility patches. See the READMEs in `packaging/analyzer` and
`packaging/electron` for build steps and limitations.


## Troubleshooting

- **Analyzer is down**: check `docker compose logs analyzer` and open
  `http://localhost:3000/api/health`. The analyzer needs its two ONNX models; keep
  `ANALYZER_DOWNLOAD_MODELS=1` in local development or bake them into the image.
- **First analysis is slow**: the analyzer loads Essentia and the voice models into memory.
- **YouTube video fails**: it may be private, region-locked, age-restricted or longer than
  `MAX_DURATION_SECONDS`. Try the audio-upload tab.
- **Apple Silicon**: the Essentia wheel is built for Linux x86-64. Docker Desktop will use
  emulation; add `platform: linux/amd64` to the analyzer service if needed.
- **Port already in use**: change the host port in `docker-compose.yml` and update
  `CORS_ORIGIN` if you call the API directly.
- **`KeyError: ContainerConfig` with `docker-compose` 1.29**: this is a known bug in the old
  standalone Compose with recent Docker versions. Run `docker-compose down` and then
  `docker-compose up -d`, or install Compose v2 and use `docker compose`.

## Licenses and commercial use

- The application code is released under **AGPL-3.0** (see [`LICENSE`](LICENSE)).
- **Essentia** is AGPL-3.0. If you expose the analyzer over a network, you must publish the
  source of the modified analyzer and the combined work.
- **YAMNet** is Apache-2.0.
- The Essentia **voice/instrumental** classifier is **CC BY-NC-SA 4.0** (non-commercial).
  Do not use it in a paid product without a commercial license or a replacement model.
- Downloading YouTube audio may violate YouTube's Terms of Service. This project is intended
  for personal experimentation and for audio you own.

Spanish documentation: [`README.es.md`](README.es.md).

## Project policies

- [Security policy](SECURITY.md)
- [Privacy](PRIVACY.md)
- [Terms of use](TERMS.md)


---

<sub>Chordifree · AGPL-3.0 · Built with [Essentia](https://essentia.upf.edu/) · [GitHub](https://github.com/moiseslodeiro/chordifree) · [Documentación en español](README.es.md)</sub>
