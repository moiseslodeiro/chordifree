# 05 — Catálogo de API

## Convenciones

- **Base:** mismo origen que la SPA (`/api`), o `http://localhost:3001/api` en desarrollo.
- **Formato:** JSON salvo subida de audio (`multipart/form-data`) y streaming de audio.
- **Autenticación:** `Authorization: Bearer <Google ID token>`.
  - En `AUTH_MODE=none` el servidor inyecta el usuario local `local@localhost`.
  - En `AUTH_MODE=google` casi todas las rutas exigen token y allowlist.
- **Errores:** envelope uniforme.

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The body must include youtubeUrl"
  }
}
```

- **Códigos de estado:** ver [`11-mapa-errores.md`](11-mapa-errores.md).

## Autenticación

### `GET /api/auth/config`

Devuelve el modo de autenticación y, en modo Google, el client ID.

| Campo | Valor |
|---|---|
| Auth | Ninguna |
| Caso de uso | CU-008 |
| Respuesta 200 | `{ "mode": "none" }` o `{ "mode": "google", "clientId": "..." }` |

### `GET /api/auth/me`

Verifica el token y devuelve el usuario, si está permitido y si es administrador.

| Campo | Valor |
|---|---|
| Auth | Bearer (en modo Google) |
| Caso de uso | CU-008 |

**Respuesta 200**

```json
{
  "user": { "uid": "123", "email": "you@example.com", "name": "You" },
  "allowed": true,
  "admin": true
}
```

**Errores:** `401 UNAUTHENTICATED`.

## Administración

Todas las rutas exigen `authenticateUser` + `requireAdmin`. En modo local el usuario local es
administrador.

### `GET /api/admin/access`

| Campo | Valor |
|---|---|
| Auth | Bearer + admin |
| Caso de uso | CU-009 |

**Respuesta 200**

```json
{
  "entries": [
    { "email": "friend@example.com", "addedAt": "2026-11-16T10:00:00.000Z", "addedBy": "you@example.com" }
  ]
}
```

### `POST /api/admin/access`

**Request**

```json
{ "email": "friend@example.com" }
```

| Código | Descripción |
|---|---|
| 201 | `{ "entry": { "email": "...", "addedAt": "..." } }` |
| 400 | `INVALID_REQUEST` si el email no es válido |
| 403 | `ADMIN_ONLY` |

### `DELETE /api/admin/access/:email`

| Código | Descripción |
|---|---|
| 204 | Eliminado |
| 404 | `NOT_FOUND` si no estaba en la lista |
| 403 | `ADMIN_ONLY` |

## Biblioteca en la nube

Solo disponibles si `AUTH_MODE=google` y el usuario está permitido.

### `GET /api/cloud/library`

| Campo | Valor |
|---|---|
| Auth | Bearer + allowlist |
| Caso de uso | CU-010 |

**Respuesta 200**

```json
{
  "songs": [
    {
      "id": "song-1",
      "title": "Demo",
      "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" },
      "updatedAt": "2026-11-16T10:00:00.000Z",
      "segments": []
    }
  ],
  "setlists": [
    {
      "id": "list-1",
      "name": "Ensayo",
      "songIds": ["song-1"],
      "createdAt": "2026-11-16T10:00:00.000Z",
      "updatedAt": "2026-11-16T10:00:00.000Z"
    }
  ],
  "updatedAt": "2026-11-16T10:00:00.000Z"
}
```

**Errores:** `401 UNAUTHENTICATED`, `403 NOT_ALLOWED`, `404 CLOUD_DISABLED`.

### `PUT /api/cloud/library`

Reemplaza el snapshot completo del usuario.

**Request**

```json
{
  "songs": [ { "id": "song-1", "title": "Demo", "updatedAt": "..." } ],
  "setlists": [ { "id": "list-1", "name": "Ensayo", "songIds": ["song-1"], "createdAt": "...", "updatedAt": "..." } ]
}
```

Límites: hasta 2000 canciones y 500 setlists. Los campos mínimos se validan con Zod; el resto
se conserva (`passthrough`).

**Respuesta 200**

```json
{ "saved": true, "songs": 1, "setlists": 1 }
```

**Errores:** `400 INVALID_REQUEST`, `401 UNAUTHENTICATED`, `404 CLOUD_DISABLED`.

## Análisis

### `POST /api/analyses`

Acepta JSON para YouTube o `multipart/form-data` para archivo.

**Request YouTube**

```json
{ "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

**Request archivo**

```text
Content-Type: multipart/form-data
file: <archivo de audio>
```

**Respuesta 202**

```json
{
  "id": "job-uuid",
  "status": "queued",
  "progress": 0,
  "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" }
}
```

**Errores:** `400 INVALID_REQUEST`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA`,
`422 INVALID_AUDIO`, `429 RATE_LIMITED`.

**Rate limit:** `RATE_LIMIT_MAX` por `RATE_LIMIT_WINDOW_MS` (60 por hora por defecto).

### `GET /api/analyses/:id`

Polling del estado.

**Respuesta 200**

```json
{
  "id": "job-uuid",
  "status": "done",
  "progress": 100,
  "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" },
  "result": {
    "source": { "type": "youtube", "videoId": "dQw4w9WgXcQ" },
    "duration": 24,
    "segments": [],
    "beats": [],
    "beatsPerBar": 4,
    "vocalRegions": [],
    "analyzerVersion": "essentia-1.6",
    "createdAt": "2026-11-16T10:00:00.000Z"
  }
}
```

Estados: `queued`, `processing`, `done`, `error`. Si falla, incluye
`error: { code, message }`.

**Errores:** `404 NOT_FOUND`.

### `DELETE /api/analyses/:id`

Cancela/elimina un job.

| Código | Descripción |
|---|---|
| 204 | Eliminado |
| 404 | `NOT_FOUND` |

## YouTube

### `GET /api/youtube/search?q=...`

| Campo | Valor |
|---|---|
| Auth | Bearer + allowlist |
| Query | `q` (1–120 caracteres) |
| Caso de uso | CU-003 |

**Respuesta 200**

```json
{
  "results": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "uploader": "Rick Astley",
      "duration": 213,
      "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    }
  ]
}
```

**Errores:** `400 INVALID_REQUEST`, `429 RATE_LIMITED`, `502 SEARCH_FAILED`.

**Rate limit:** 30/minuto.

### `POST /api/youtube/:videoId/audio`

Prepara el audio temporal para el reproductor con pitch.

**Respuesta 200**

```json
{
  "url": "/api/youtube/dQw4w9WgXcQ/audio",
  "expiresAt": "2026-11-16T11:00:00.000Z"
}
```

**Errores:** `400 INVALID_REQUEST`, `429 RATE_LIMITED`.

**Rate limit:** 20/minuto.

### `GET /api/youtube/:videoId/audio`

Streaming del audio temporal con soporte de `Range`.

| Código | Descripción |
|---|---|
| 200 | Audio (`Content-Type` según el archivo) |
| 404 | `AUDIO_NOT_READY` |

Cabeceras: `Cache-Control: private, no-store`.

### `GET /api/youtube/audio-cache`

Estadísticas del audio temporal.

```json
{ "entries": 2, "bytes": 1234567, "ttlMinutes": 60 }
```

### `DELETE /api/youtube/audio-cache`

Borra todos los archivos temporales.

```json
{ "removed": 2 }
```

## Letras

### `GET /api/lyrics?title=...&artist=...&duration=...`

| Campo | Valor |
|---|---|
| Auth | Bearer + allowlist |
| Query | `title` obligatorio (1–200), `artist` opcional (≤200), `duration` opcional (1–3600) |
| Caso de uso | CU-012 |

**Respuesta 200**

```json
{
  "lyrics": "Line one\nLine two",
  "syncedLyrics": "[00:01.00] Line one",
  "trackName": "Demo",
  "artistName": "Artist",
  "albumName": "Album",
  "duration": 180,
  "source": "lrclib"
}
```

**Errores:** `400 INVALID_REQUEST`, `404 LYRICS_NOT_FOUND`, `429 RATE_LIMITED`,
`502 LYRICS_UNAVAILABLE`.

**Rate limit:** 30/minuto.

## Salud

### `GET /api/health`

Público. Comprueba también el analyzer.

```json
{ "status": "ok", "analyzer": "ok", "analyzerVersion": "essentia-1.6" }
```

Si el analyzer no responde, `analyzer` es `"down"` pero el endpoint sigue devolviendo 200 para
que Cloud Run no reinicie el servidor por un fallo del analizador.

## Analyzer (interno)

No forma parte de `/api`; solo lo llama el servidor.

### `GET /health`

```json
{ "status": "ok", "analyzerVersion": "essentia-1.6" }
```

### `POST /analyze`

`multipart/form-data` con `file`. Devuelve segmentos, duración, pulsos, compás y regiones
vocales. En Cloud Run, la autenticación la hace la plataforma con un ID token; en local se usa
`X-Chordifree-Token` si `ANALYZER_TOKEN` está definido.

**Errores:** `401` token inválido, `413` archivo demasiado grande, `422` formato/decodificación,
`503` analyzer no disponible.

## Resumen de autenticación

| Ruta | Local (`none`) | Online (`google`) |
|---|---|---|
| `/api/health` | Pública | Pública |
| `/api/auth/config` | Pública | Pública |
| `/api/auth/me` | Usuario local | Token + verificación |
| `/api/admin/*` | Admin local | Token + admin |
| `/api/cloud/*` | `404 CLOUD_DISABLED` | Token + allowlist |
| `/api/analyses`, `/api/lyrics`, `/api/youtube` | Usuario local | Token + allowlist |
| Analyzer | Token compartido opcional | IAM de Cloud Run |
