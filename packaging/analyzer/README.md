# Analyzer sidecar packaging

This folder builds a self-contained analyzer for the desktop app.

## Local build (Linux/macOS)

```bash
cd /path/to/chordifree
python3.11 -m venv .venv-sidecar
. .venv-sidecar/bin/activate
pip install -r services/analyzer/requirements.txt
pip install pyinstaller
pyinstaller packaging/analyzer/analyzer.spec --noconfirm
ANALYZER_PORT=8123 ./dist/analyzer/analyzer
```

## Windows

Essentia does not publish an official Windows wheel yet. The GitHub workflow
`windows-analyzer.yml` builds a wheel from the open Essentia Windows PR and then
freezes the analyzer with PyInstaller. This is a spike, not a stable release
dependency.

## Runtime

The sidecar binds to `127.0.0.1` on the port in `ANALYZER_PORT` and reads models
from the bundled `models/` directory. Set `ANALYZER_DOWNLOAD_MODELS=0` so it never
downloads models at runtime.
