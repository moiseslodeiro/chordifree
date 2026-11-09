# Chordifree Server

Express API that orchestrates audio extraction and chord analysis.

## Run

```bash
cp ../../.env.example ../../.env
pnpm --filter @chordifree/server dev
```

Requires `yt-dlp`, `ffmpeg` and `ffprobe` on `PATH` (or configured through environment
variables) and the analyzer microservice at `ANALYZER_URL`.

## Endpoints

### `GET /api/health`

```bash
curl -fsS http://localhost:3001/api/health
# {"status":"ok","analyzer":"ok","analyzerVersion":"essentia-1.6"}
```

Returns `200` even if the analyzer is down; in that case `analyzer` is `"down"`.

### `POST /api/analyses` (YouTube)

```bash
curl -fsS -X POST http://localhost:3001/api/analyses \
  -H 'Content-Type: application/json' \
  -d '{"youtubeUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

`202` response:

```json
{ "id": "0f5c...", "status": "queued", "progress": 0, "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" } }
```

### `POST /api/analyses` (upload)

```bash
curl -fsS -X POST http://localhost:3001/api/analyses \
  -F "file=@song.mp3"
```

Supported formats: MP3, WAV, M4A, OGG, FLAC, WebM and MP4, up to 25 MB.

### `GET /api/analyses/:id`

```bash
curl -fsS http://localhost:3001/api/analyses/0f5c...
```

```json
{
  "id": "0f5c...",
  "status": "done",
  "progress": 100,
  "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" },
  "result": {
    "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" },
    "duration": 213.4,
    "segments": [{ "start": 0, "end": 4.2, "chord": { "root": 9, "quality": "minor" } }],
    "beats": [0.42, 0.91, 1.38, 1.87],
    "beatsPerBar": 4,
    "vocalRegions": [{ "start": 36.0, "end": 90.72 }],
    "analyzerVersion": "essentia-1.6",
    "createdAt": "2026-10-29T12:00:00.000Z"
  }
}
```

`beats` are sanitized, sorted beat times in seconds; `beatsPerBar` is always `4` in this
version. If the analyzer cannot detect a rhythm, `beats` is empty and the web app falls back
to the list view. `vocalRegions` contains detected sung sections; it can be empty.

States: `queued`, `processing`, `done`, `error`.

## Error codes

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_URL` | 400 | Malformed URL or invalid video ID |
| `UNSUPPORTED_HOST` | 400 | Host other than YouTube |
| `MISSING_VIDEO_ID` | 400 | YouTube link without `v` |
| `INVALID_REQUEST` | 400 | Invalid body or form |
| `UNSUPPORTED_MEDIA` | 415 | Unsupported content type |
| `FILE_TOO_LARGE` | 413 | Upload larger than 25 MB |
| `INVALID_AUDIO` | 422 | The file is not valid audio |
| `DURATION_EXCEEDED` | 422 | Audio longer than 15 minutes |
| `VIDEO_UNAVAILABLE` | 422 | Private, deleted or non-downloadable video |
| `ANALYSIS_FAILED` | 502 | Analyzer failure |
| `RATE_LIMITED` | 429 | Per-IP limit exceeded |
| `NOT_FOUND` | 404 | Unknown analysis |

Error bodies always look like:

```json
{ "error": { "code": "INVALID_URL", "message": "..." } }
```

## Limits

Configurable through environment variables: `MAX_DURATION_SECONDS`, `MAX_UPLOAD_BYTES`,
`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`. Results are cached for 24 hours per video ID and
temporary files are swept every 10 minutes.

## Tests

```bash
pnpm --filter @chordifree/server test
```

Integration tests use mocked tools and analyzer; real conversion is exercised with the
`ffmpeg-static` and `ffprobe-static` binaries.
