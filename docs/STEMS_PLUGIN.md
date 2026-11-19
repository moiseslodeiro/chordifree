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
