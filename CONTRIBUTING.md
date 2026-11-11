# Contributing to Chordifree

Thanks for taking the time to improve Chordifree. This document covers the local setup,
the checks a pull request should pass and the project conventions.

## Requirements

- Node.js 20+ and pnpm 9+
- Python 3.11+
- Docker and Docker Compose (for the full stack)
- ffmpeg, ffprobe and yt-dlp (for the API outside Docker)

## Local setup

```bash
pnpm install
cp .env.example .env

# Analyzer
python3 -m venv .venv
. .venv/bin/activate
pip install -r services/analyzer/requirements.txt
uvicorn app.main:app --app-dir services/analyzer --port 8000

# Web + API
pnpm dev
```

Open <http://localhost:5173>.

The Docker stack is the fastest way to test the full pipeline:

```bash
docker compose up --build -d
# http://localhost:3000
```

## Checks before opening a pull request

```bash
pnpm typecheck
pnpm lint
pnpm -r test
pnpm --filter @chordifree/web exec playwright test
.venv/bin/python -m pytest services/analyzer/tests
```

For the desktop packaging:

```bash
pnpm --filter @chordifree/web build
cd packaging/electron
pnpm install --ignore-workspace
pnpm build:server
```

Build the analyzer first (see `packaging/analyzer/README.md`) if you need to run the
packaged app.

## Conventions

- Keep the UI and analyzer messages in English and Spanish (`apps/web/src/i18n/messages.ts`).
- Add tests for behavior changes in `apps/web/tests`, `apps/server/tests` or
  `services/analyzer/tests`.
- Do not commit generated output: `dist/`, `build/`, `release/`, `resources/`,
  `node_modules/`, `.venv/` and ONNX models are ignored.
- Do not commit credentials, API tokens, cookies or local `.env` files.
- The analyzer models have their own licenses; check `services/analyzer/models/README.md`
  before redistributing them.
- Keep changes focused. Separate backend, web and packaging changes when they are independent.

## Licensing

By contributing you agree that your changes are released under the project license,
AGPL-3.0-or-later.
