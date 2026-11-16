# 11 — Mapa de errores

## Envelope

Todas las rutas de la API devuelven el mismo formato:

```json
{ "error": { "code": "INVALID_REQUEST", "message": "..." } }
```

La SPA convierte `code` a un mensaje localizado con `i18n/errors.ts`. Los errores de red o
respuestas no JSON se convierten en `ANALYSIS_FAILED` o en un mensaje genérico.

## Catálogo HTTP

| Código | HTTP | Origen | Mensaje típico | Recuperación | CU | Severidad |
|---|---|---|---|---|---|---|
| `INVALID_URL` | 400 | Extracción de YouTube | Enlace no válido | Corregir el enlace | CU-001 | Baja |
| `UNSUPPORTED_HOST` | 400 | Extracción de YouTube | Host no soportado | Usar YouTube | CU-001 | Baja |
| `MISSING_VIDEO_ID` | 400 | Extracción de YouTube | Falta el ID del video | Corregir el enlace | CU-001 | Baja |
| `DURATION_EXCEEDED` | 422 | Análisis | Duración máxima superada | Usar un audio más corto | CU-001/002 | Media |
| `FILE_TOO_LARGE` | 413 | Multer / analyzer | Archivo demasiado grande | Reducir el archivo | CU-002 | Baja |
| `INVALID_AUDIO` | 422 | Validación de audio | Formato o firma inválidos | Usar MP3/WAV/M4A/OGG/FLAC/WebM/MP4 | CU-002 | Baja |
| `VIDEO_UNAVAILABLE` | 422 | yt-dlp | Video no disponible | Probar otro video | CU-001 | Media |
| `YOUTUBE_BLOCKED` | 422 | yt-dlp | YouTube bloquea este servidor | Subir el audio o reintentar más tarde | CU-001/003 | Media |
| `SEARCH_FAILED` | 502 | yt-dlp | Búsqueda fallida | Reintentar más tarde | CU-003 | Media |
| `ANALYSIS_FAILED` | 502 | Analyzer / servidor | No se pudo analizar | Reintentar o revisar logs | CU-001/002 | Alta |
| `RATE_LIMITED` | 429 | express-rate-limit / LRCLIB | Demasiadas peticiones | Esperar `Retry-After` | CU-001/003/011/012 | Media |
| `NOT_FOUND` | 404 | Rutas y recursos | Recurso no encontrado | Corregir ID | Varios | Baja |
| `AUDIO_NOT_READY` | 404 | Caché temporal | Audio temporal no disponible | Prepararlo de nuevo | CU-011 | Baja |
| `UNAUTHENTICATED` | 401 | Auth | Inicia sesión con Google | Reautenticarse | CU-008/009/010 | Alta |
| `NOT_ALLOWED` | 403 | Allowlist | Cuenta no permitida | Pedir acceso al admin | CU-008 | Alta |
| `ADMIN_ONLY` | 403 | Admin | Se requiere administrador | Usar cuenta admin | CU-009 | Media |
| `CLOUD_DISABLED` | 404 | Cloud library | Nube deshabilitada | Usar modo local | CU-010 | Baja |
| `INVALID_REQUEST` | 400 | Zod / validaciones | Petición inválida | Corregir payload | Varios | Baja |
| `UNSUPPORTED_MEDIA` | 415 | Análisis | Envía JSON o multipart | Corregir `Content-Type` | CU-001/002 | Baja |
| `LYRICS_NOT_FOUND` | 404 | LRCLIB | Sin letra | Pegarla a mano | CU-012 | Baja |
| `LYRICS_UNAVAILABLE` | 502 | LRCLIB | Proveedor no disponible | Reintentar / pegar letra | CU-012 | Media |
| `FORBIDDEN` | 403 | Same-origin guard | Petición cruzada bloqueada | Usar el mismo origen | Varios | Media |

## Errores no HTTP

| Tipo | Origen | Efecto | Recuperación |
|---|---|---|---|
| `MulterError LIMIT_FILE_SIZE` | Subida | 413 `FILE_TOO_LARGE` | Archivo más pequeño |
| `MulterError` genérico | Subida | 400 `INVALID_REQUEST` | Reintentar la subida |
| Respuesta no JSON | Proxy/red | `ANALYSIS_FAILED` | Reintentar |
| `QuotaExceededError` | `localStorage` | `StorageQuotaError` | Limpiar caché/exportar |
| Datos corruptos | `localStorage` | Se mueven a `corrupt:*` | Importar un backup |
| Timeout de analyzer | Servidor | `ANALYSIS_FAILED` | Reintentar |
| Timeout de yt-dlp | Servidor | `VIDEO_UNAVAILABLE` / `SEARCH_FAILED` | Reintentar |
| Firestore no disponible | Auth/cloud | 500 / 502 | Reintentar; revisar IAM/cuota |
| Token caducado | SPA | Evento `chordifree:unauthorized` | Volver a iniciar sesión |

## Comportamiento de la SPA

- `401` dispara `chordifree:unauthorized`, limpia el token y vuelve a la pantalla de login.
- `403 NOT_ALLOWED` muestra la pantalla de acceso restringido.
- Los errores de sincronización no borran la copia local; se muestra un aviso y se reintenta en
  el siguiente cambio o con **Sync now**.
- Los errores de análisis se muestran en el runner con el mensaje localizado.

## Observabilidad

- El servidor registra los errores no controlados con `console.error` y responde
  `ANALYSIS_FAILED`.
- Cloud Run recoge stdout/stderr en Cloud Logging.
- No hay alertas automáticas de errores ni tracing distribuido (`[PENDING]`).
