# Stems plugin (reference)

Optional local separation and transcription for the desktop build. It is not
bundled with the installer: install it under `~/.config/chordifree/stems` and
point the server at it with `STEMS_PLUGIN_DIR`.

## What it produces

- `vocals.wav`, `drums.wav`, `bass.wav`, `other.wav` from Demucs.
- `bass.notes.json` and `drums.notes.json` with monophonic bass notes and
  classified drum hits. The web app offers **MIDI from stems** once those files
  exist.

## Install

On desktop, open **Pistas** (`#/stems`) and press **Install plugin**. The app
copies `separate.py`, `transcribe.py` and the manifest into its user data folder,
creates the virtualenv and installs the dependencies. You can cancel the
download and uninstall it later from the same screen.

Manual install:

```bash
python3 -m venv ~/.local/share/chordifree/stems-venv
~/.local/share/chordifree/stems-venv/bin/pip install -r requirements.txt
mkdir -p ~/.config/chordifree/stems
cp run.sh separate.py transcribe.py manifest.json ~/.config/chordifree/stems/
```

`ffmpeg` must be on `PATH`. The first run downloads the Demucs model (~80 MB).
If the virtualenv lives elsewhere, set `STEMS_VENV` before starting the server.

```bash
STEMS_PLUGIN_DIR=~/.config/chordifree/stems pnpm dev
```

## Notes format

```json
{
  "notes": [{ "start": 12.34, "end": 12.91, "pitch": 40, "velocity": 92 }]
}
```

Times are seconds from the start of the song and `pitch` is a MIDI note. The
manifest declares the stems to transcribe:

```json
"transcribe": ["bass", "drums"]
```

The server validates the JSON before exposing it at
`/api/stems/jobs/:id/notes/:stem`.

## Accuracy

The bass uses `librosa.pyin` on the separated bass stem; it handles sustained
lines well and can jump an octave on distorted or very low notes. The drums use
onset detection plus a three-band energy rule (kick / snare / hi-hat), so it
captures the groove but not fills or cymbals in detail. Both are meant to make
the MIDI arrangement closer to the recording, not to be a perfect transcription.
