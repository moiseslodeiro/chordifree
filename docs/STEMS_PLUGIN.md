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
`0700`. The app downloads the dependencies only when you press **Install
plugin** in `#/stems`; it does not update them on its own.

## Install from the app (desktop)

The desktop build can install the plugin without leaving Chordifree. Open
**Pistas separadas** (`#/stems`, also in the header) and press **Install
plugin**. The app:

1. looks for Python 3.10 to 3.13 (`python3.12`, `python3.11`, `py -3.12`…);
2. copies the scripts bundled with the app (`separate.py`, `transcribe.py`);
3. creates a virtualenv inside the app's user data folder and installs CPU
   PyTorch, Demucs and librosa (about 1.5 GB, once);
4. writes the plugin manifest and checks that the packages import.

The download can be cancelled while it runs. Uninstall removes the virtualenv
and the downloaded model; the separated-stem cache is managed separately in the
same screen.

The installer only accepts the scripts shipped with Chordifree and runs a fixed
set of commands; it never downloads code from a URL. It also refuses to write
into a folder that already contains a plugin it did not create. The endpoints
exist only in local mode; the hosted instance reports `supported: false` and
cannot install or separate audio.

For the local web build (not the packaged app), point the server at a managed
folder and the repository scripts:

```bash
STEMS_PLUGIN_DIR=$HOME/.local/share/chordifree/stems \
STEMS_SETUP_DIR=$HOME/.local/share/chordifree/stems \
STEMS_PLUGIN_SOURCE=$PWD/services/stems-plugin \
pnpm dev
```

The packaged desktop app sets those variables itself. The plugin is not part of
the installer; the first run downloads the Demucs weights (~80 MB) into the
managed folder.

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

| Method   | Path                              | Result                                                                            |
| -------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `GET`    | `/api/stems`                      | `{ available, name?, version?, stems?, error? }`                                  |
| `POST`   | `/api/stems/:videoId`             | `202` with a job (`queued` → `processing` → `done`/`error`); optional `{ title }` |
| `GET`    | `/api/stems/jobs`                 | Recent jobs, newest first (`done`, `cancelled`, `error`…)                         |
| `GET`    | `/api/stems/jobs/:id`             | Job status, `stems` and `midi` when done                                          |
| `POST`   | `/api/stems/jobs/:id/cancel`      | Cancels a queued/running job; idempotent for finished jobs                        |
| `GET`    | `/api/stems/jobs/:id/:stem`       | WAV stream, `Cache-Control: private, no-store`                                    |
| `GET`    | `/api/stems/jobs/:id/notes/:stem` | Transcribed notes JSON, when the plugin declares them                             |
| `GET`    | `/api/stems/cache`                | Cached separations with size, stems and MIDI list                                 |
| `GET`    | `/api/stems/cache/:videoId`       | One cached entry, or `404` when the song was not separated yet                    |
| `DELETE` | `/api/stems/cache/:videoId`       | Removes one cached separation                                                     |
| `DELETE` | `/api/stems/cache`                | Removes every cached separation                                                   |

`POST` needs the temporary YouTube audio the first time, so the song must have
been played once. A cache hit returns a `done` job immediately without touching
the audio or the model; the same job is reused while the app is open.

Jobs run in the server process, not in the page: changing songs, closing the
song view or navigating to another route does not stop the separation. The
API keeps the last 20 jobs in memory, and cancellation kills the whole plugin
process group (including Demucs) so no worker is left behind.

## Persistent cache

Completed separations are moved out of the temporary job directory into a
local-only cache under `$TEMP_DIR/stems-cache` (default `apps/server/.tmp`).
Each entry is keyed by `sha256(videoId + plugin@version)` and records its WAV
files, notes and byte size in `index.json`. The cache survives restarts and is
capped at 20 entries / 2 GB, evicting the oldest entry first.

Only separations produced locally are cached; the hosted instance never stores
derived audio. Delete entries with the API above or from **Pistas separadas**
(`#/stems`), which also lists running jobs and lets you cancel them.

## From the web UI

When the API reports the plugin as available, the song view shows a **Stems**
card inside the collapsible **Audio** section for YouTube songs:

1. If the plugin is not installed, the **Audio** card shows a **Go to install**
   link to the **Stems** screen. Once installed, press **Separate stems**. A
   cached song opens instantly; otherwise the card shows the running job and a
   **Cancel separation** button. You can leave the song while it works and come
   back later: the card reattaches to the job, or to the cache once it finishes.
2. When the job is done, **Mix stems** loads the four WAVs as synchronized
   audio elements and plays them together; only then do the per-stem volume
   sliders appear (for example vocals 50%, drums 0%, other 100%). **Original**
   returns to the source track and hides the sliders again, so moving them
   always has an audible effect.
3. The mix uses one master clock and corrects drift, so seeking, speed and the
   grid stay aligned. Pitch and the karaoke toggle apply to the original track
   and are disabled while the mix is active; lower the vocal slider instead.
4. **MIDI from stems** downloads the arrangement with the transcribed bass and
   drums. **Pistas separadas** (`#/stems`, also in the header) shows all jobs,
   the cache size and the buttons to remove one song or clear everything. Each
   cached song has a **Play mix** button and one button per stem, so the cache
   can be auditioned without opening the song again. It also has **Go to song**
   when the song is in the library, and **Download stems** to save every WAV in
   one go. A managed plugin can be uninstalled from that screen or from the
   song's **Stems** card; the app asks for confirmation first.
5. The header links **Biblioteca**, **Listas** and **Pistas** from every
   screen; the stems link only appears when the plugin or service is available.

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

## Transcription (bass and drums)

The plugin can also return notes for some stems. Add them to the manifest:

```json
"transcribe": ["bass", "drums"]
```

and write `<stem>.notes.json` next to the audio:

```json
{ "notes": [{ "start": 0, "end": 0.9, "pitch": 40, "velocity": 92 }] }
```

Times are seconds and `pitch` is a MIDI note. The server validates the file and
exposes it at `GET /api/stems/jobs/:id/notes/:stem`; the job lists the available
stems in `midi`. The song view then offers **MIDI from stems**, which keeps the
generated chords, pad and section markers but replaces the bass and drum tracks
with the transcribed ones.

[`services/stems-plugin`](../services/stems-plugin) is a working reference: it
runs Demucs, uses `librosa.pyin` for the bass and onset detection plus a
three-band rule for the drums, and writes the JSON files. Install it with
`pip install -r services/stems-plugin/requirements.txt` and copy the files to
the plugin directory.

The transcription runs locally, on the CPU: expect a similar order of time as the
separation itself. The result is an arrangement, not a perfect transcription;
bass octave errors and simplified drum patterns are normal and can be corrected
in the DAW.

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
The in-app installer is disabled there; configure the remote service instead.

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

1. Vocal melody transcription from the vocal stem (basic-pitch/CREPE), the
   remaining piece for a full MIDI arrangement.
2. Mute/solo shortcuts and saved per-song mix presets on top of the current
   four-slider mixer.
3. Extend the remote service contract with the same `notes` and `cancel`
   endpoints, so a GPU machine can return transcribed stems and stop jobs too.
4. 4–6 stem engines and an install flow with SHA-256 and pinned versions.
5. Keep derived audio local; do not upload it to the cloud instance. The
   YouTube legal notice still applies.
