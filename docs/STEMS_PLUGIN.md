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

1. UI: per-stem mute/solo with a shared clock, plus a "separate" action on the
   song view (status card is already in the API).
2. Reuse the existing temporary-audio proxy for playback; render pre-mixed
   variants ("instrumental", "no drums") before implementing a true mixer.
3. Cache job metadata by `videoId + plugin version`, and evict with the audio
   cache TTL.
4. 4–6 stem engines and an install flow with SHA-256 and pinned versions.
5. Keep derived audio local; do not upload it to the cloud instance. The
   YouTube legal notice still applies.
