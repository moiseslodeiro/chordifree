#!/usr/bin/env bash
# Reference stems plugin: Demucs 4-stem separation plus bass/drum notes.
set -euo pipefail
input="$1"
output="$2"
here="$(cd "$(dirname "$0")" && pwd)"
venv="${STEMS_VENV:-$HOME/.local/share/chordifree/stems-venv}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

ffmpeg -y -v error -i "$input" -ac 2 -ar 44100 "$work/input.wav"
"$venv/bin/python" -m demucs -n htdemucs -o "$work" "$work/input.wav" >/dev/null 2>&1

for stem in vocals drums bass other; do
  cp "$(find "$work" -name "$stem.wav" | head -1)" "$output/$stem.wav"
done

"$venv/bin/python" "$here/transcribe.py" bass "$output/bass.wav" "$output/bass.notes.json"
"$venv/bin/python" "$here/transcribe.py" drums "$output/drums.wav" "$output/drums.notes.json"
