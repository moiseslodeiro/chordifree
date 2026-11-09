# Chordifree Server

API Express que orquesta la extracción de audio y el análisis de acordes.

## Ejecutar

```bash
cp ../../.env.example ../../.env
pnpm --filter @chordifree/server dev
```

Requiere `yt-dlp`, `ffmpeg` y `ffprobe` en el `PATH` (o configurados por entorno) y el
microservicio analizador en `ANALYZER_URL`.

## Endpoints

### `GET /api/health`

```bash
curl -fsS http://localhost:3001/api/health
# {"status":"ok","analyzer":"ok","analyzerVersion":"essentia-1.5"}
```

Devuelve `200` incluso si el analizador está caído; en ese caso `analyzer` vale `"down"`.

### `POST /api/analyses` (YouTube)

```bash
curl -fsS -X POST http://localhost:3001/api/analyses \
  -H 'Content-Type: application/json' \
  -d '{"youtubeUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Respuesta `202`:

```json
{ "id": "0f5c...", "status": "queued", "progress": 0, "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" } }
```

### `POST /api/analyses` (subida)

```bash
curl -fsS -X POST http://localhost:3001/api/analyses \
  -F "file=@cancion.mp3"
```

Formatos admitidos: MP3, WAV, M4A, OGG, FLAC, WebM y MP4, hasta 25 MB.

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
    "analyzerVersion": "essentia-1.5",
    "createdAt": "2026-10-29T12:00:00.000Z"
  }
}
```

`beats` son los pulsos en segundos, saneados y ordenados; `beatsPerBar` es siempre `4` en
esta versión. Si el analizador no detecta ritmo, `beats` llega vacío y la web usa la vista de
lista.

Estados: `queued`, `processing`, `done`, `error`.

## Códigos de error

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `INVALID_URL` | 400 | URL malformada o ID con formato inválido |
| `UNSUPPORTED_HOST` | 400 | Host distinto de YouTube |
| `MISSING_VIDEO_ID` | 400 | Enlace de YouTube sin `v` |
| `INVALID_REQUEST` | 400 | Cuerpo o formulario inválido |
| `UNSUPPORTED_MEDIA` | 415 | Tipo de contenido no soportado |
| `FILE_TOO_LARGE` | 413 | Subida mayor de 25 MB |
| `INVALID_AUDIO` | 422 | El archivo no es audio válido |
| `DURATION_EXCEEDED` | 422 | Audio de más de 15 minutos |
| `VIDEO_UNAVAILABLE` | 422 | Video privado, eliminado o no descargable |
| `ANALYSIS_FAILED` | 502 | Fallo del analizador |
| `RATE_LIMITED` | 429 | Límite por IP excedido |
| `NOT_FOUND` | 404 | Análisis inexistente |

El cuerpo de error siempre tiene la forma:

```json
{ "error": { "code": "INVALID_URL", "message": "..." } }
```

## Límites

Configurables por entorno: `MAX_DURATION_SECONDS`, `MAX_UPLOAD_BYTES`,
`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`. Los resultados se cachean 24 horas por ID de
video y los temporales se barren cada 10 minutos.

## Tests

```bash
pnpm --filter @chordifree/server test
```

Los tests de integración usan herramientas y analizador simulados; la conversión real se
prueba con los binarios de `ffmpeg-static` y `ffprobe-static`.
