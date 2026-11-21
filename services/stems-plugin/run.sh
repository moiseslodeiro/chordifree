#!/usr/bin/env bash
# Reference stems plugin: Demucs 4-stem separation plus bass/drum notes.
# The desktop app installs this same script with its own virtualenv; when
# running manually, point STEMS_VENV at the environment with the dependencies.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
venv="${STEMS_VENV:-$HOME/.local/share/chordifree/stems-venv}"
exec "$venv/bin/python" "$here/separate.py" "$1" "$2"
