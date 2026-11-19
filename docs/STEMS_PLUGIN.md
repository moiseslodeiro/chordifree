# Stems plugin (desktop)

Optional local audio separation. The server never downloads or ships a
separation model: on desktop, the user can install a plugin directory that the
API runs locally. Without it, `GET /api/stems` reports `available: false` and
the rest of the app is unchanged.

## Why local

Real stem separation (Demucs, MDX-Net) needs hundreds of MB of models and
minutes of CPU. Running it in the hosted instance would add a GPU bill to every
song and store derived audio. The desktop app already has the audio locally, so
the plugin keeps the cost and the data on the user's machine.

Center-channel cancellation (the karaoke toggle) remains the zero-cost
alternative for a quick instrumental.

## Install

1. Create a plugin directory, for example `~/.config/chordifree/stems`.
2. Put the engine and its models there, plus a `manifest.json`.
3. Start the server or desktop app with `STEMS_PLUGIN_DIR` pointing at it.

The directory is trusted executable code. Keep it owned by your user with mode
`0700`; the app does not download or update plugins by itself.

## Manifest

```json
{
  "name": "demucs-2stems",
  "version": "4.0.1",
  "command": "python3",
  "args": ["-m", "demucs", "--two-stems=vocals", "-o", "{output}", "{input}"],
  "stems": ["vocals", "no_vocals"],
  "outputExtension": ".wav",
  "timeoutSeconds": 900
}
```

- `command` runs without a shell; `args` are passed as separate arguments.
- `{input}` is the cached audio file and `{output}` an empty directory for the job.
- Each name in `stems` must end up as `<stem><outputExtension>` (or `<stem>.*`) in
  the output directory. Missing files fail the job with `STEMS_FAILED`.
- `stems` accepts 1–12 lowercase names, `timeoutSeconds` 30–3600.

The engine may also be an ONNX runner or a wrapper script; the contract is only
"read the input file, write the declared files to the output directory".

## API

All routes require the same auth as the rest of `/api` and are meant for
local/desktop use.

| Method | Path                        | Result                                                      |
| ------ | --------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/stems`                | `{ available, name?, version?, stems?, error? }`            |
| `POST` | `/api/stems/:videoId`       | `202` with a job (`queued` → `processing` → `done`/`error`) |
| `GET`  | `/api/stems/jobs/:id`       | Job status, `stems: ["vocals", "no_vocals"]` when done      |
| `GET`  | `/api/stems/jobs/:id/:stem` | WAV stream, `Cache-Control: private, no-store`              |

`POST` needs the temporary YouTube audio, so the song must have been played
once. Jobs live in memory (last 20) and their files are deleted when evicted.

## From the web UI

When the API reports the plugin as available, the song view shows a **Stems**
card for YouTube songs:

1. Open the song and press **Separate stems**. The server uses the temporary
   audio it already cached when the song was opened.
2. The card waits for the job and then lists the stems the plugin declares.
3. Selecting a stem swaps the player source (fetched as an authenticated blob);
   **Original** returns to the song. The selected stem can be downloaded as a
   WAV. Pitch, speed and the practice tools keep working on top of it.

There is still no multi-source mixer: you hear one source at a time. Mute/solo
per stem is the next step.

## Local Demucs recipe (CPU)

The plugin used for the local verification:

```bash
python3 -m venv ~/.local/share/chordifree/stems-venv
~/.local/share/chordifree/stems-venv/bin/pip install torch torchaudio \
  --index-url https://download.pytorch.org/whl/cpu
~/.local/share/chordifree/stems-venv/bin/pip install demucs numpy
mkdir -p ~/.config/chordifree/stems-2
```

`~/.config/chordifree/stems-2/separate.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
input="$1"; output="$2"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Demucs handles m4a, but normalising first also covers webm/opus inputs.
ffmpeg -y -v error -i "$input" -ac 2 -ar 44100 "$work/input.wav"
"$HOME/.local/share/chordifree/stems-venv/bin/python" -m demucs \
  --two-stems=vocals -o "$work" "$work/input.wav" >/dev/null 2>&1
cp "$(find "$work" -name vocals.wav | head -1)" "$output/vocals.wav"
cp "$(find "$work" -name no_vocals.wav | head -1)" "$output/no_vocals.wav"
```

Use `-n htdemucs` without `--two-stems` for four stems (`vocals`, `drums`,
`bass`, `other`). Then start with:

```bash
STEMS_PLUGIN_DIR=~/.config/chordifree/stems-2 pnpm dev
```

Measured on a 16-core CPU with the model cached: 6 s of audio takes ~18 s for
two stems, and a 19 s song ~28 s. Longer songs scale roughly with duration, so
the UI warns that it can take several minutes. The first run also downloads the
model (~80 MB).

## Remote service

Instead of a local plugin, an operator can point the server at a separate
separation service on another machine:

```bash
STEMS_SERVICE_URL=https://stems.example.internal
STEMS_SERVICE_TOKEN=optional-shared-token
STEMS_SERVICE_TIMEOUT_MS=1800000
```

`STEMS_SERVICE_URL` takes precedence over `STEMS_PLUGIN_DIR`, and the token is
sent as a Bearer header. The UI and `GET /api/stems` show the remote service
exactly like the local plugin, so the app does not care where the model runs.
Hosted Cloud Run can use this to reach a machine with more CPU or a GPU.

The server uploads the cached audio to the remote service, so it leaves the
instance: only configure it with a service you trust. The contract is:

| Method | Path              | Body / result                                         |
| ------ | ----------------- | ----------------------------------------------------- |
| `GET`  | `/health`         | `{ status: "ok", name?, version?, stems?: string[] }` |
| `POST` | `/separate`       | multipart `file` → `{ id, status, stems?, error? }`   |
| `GET`  | `/jobs/:id`       | same job shape (`queued`/`processing`/`done`/`error`) |
| `GET`  | `/jobs/:id/:stem` | the separated audio file                              |

The server polls every 3 s, downloads the stems into its temporary directory and
serves them through the authenticated `/api/stems/jobs/:id/:stem` route. The
browser never talks to the remote service directly.

## Testing without a model

The test suite registers a fake plugin that copies dummy files; see
`apps/server/tests/stems.test.ts`. A minimal local check:

```bash
mkdir -p /tmp/stems-plugin
cat > /tmp/stems-plugin/run.sh <<'EOF'
#!/bin/sh
cp "$1" "$2/vocals.wav"
cp "$1" "$2/no_vocals.wav"
EOF
chmod +x /tmp/stems-plugin/run.sh
cat > /tmp/stems-plugin/manifest.json <<'EOF'
{
  "name": "copy",
  "version": "0.0.1",
  "command": "/tmp/stems-plugin/run.sh",
  "args": ["{input}", "{output}"],
  "stems": ["vocals", "no_vocals"]
}
EOF
STEMS_PLUGIN_DIR=/tmp/stems-plugin pnpm dev
```

## Roadmap

1. A true mixer: mute/solo per stem with a shared clock, instead of swapping
   the source. Pre-rendered mixes ("instrumental", "no drums") are the cheap
   intermediate step.
2. Cache job metadata by `videoId + plugin version`, and evict with the audio
   cache TTL.
3. 4–6 stem engines and an install flow with SHA-256 and pinned versions.
4. Keep derived audio local; do not upload it to the cloud instance. The
   YouTube legal notice still applies.
