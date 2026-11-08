# Design

## Context

El repositorio solo contiene la configuración de OpenSpec; no hay código previo. El cambio introduce tres piezas ejecutables y un contrato de datos compartido. Ver `proposal.md` para la motivación y `specs/` para el comportamiento exigido.

Restricciones que condicionan el diseño:

- La detección automática exige descargar el audio del video, algo que el navegador no puede hacer por CORS y por la protección del reproductor de YouTube.
- Essentia es una biblioteca nativa de Python; no existe una vía práctica de ejecutarla en Node.
- La persistencia es exclusivamente local: no hay cuentas, base de datos ni sincronización.
- El análisis tarda entre 10 y 60 segundos, por lo que no cabe en una petición HTTP síncrona razonable.
- El proyecto debe funcionar en desarrollo con un solo comando y desplegarse con contenedores.

## Goals / Non-Goals

**Goals:**

- Un contrato de acorde y de segmento único, compartido por backend, analizador y frontend.
- Pipeline de análisis reproducible y observable, con estados y errores estables.
- Sincronización de la rejilla perceptualmente inmediata (<250 ms) y navegable.
- Trasposición y cambio de notación puramente en cliente, sin reanálisis.
- Biblioteca local tolerante a cuotas, corrupción y versiones.

**Non-Goals:**

- Detección de tonalidad, tempo o compás como funcionalidad de producto (solo se usa la tonalidad estimada para la ortografía enarmónica).
- Separación de pistas, letras, tablaturas de guitarra o diagramas de posiciones.
- Edición colaborativa, cuentas o sincronización entre dispositivos.
- Descarga del audio o del video por parte del usuario.
- Soporte de fuentes distintas de YouTube y la subida de archivos.

## Decisions

### 1. Monorepo con tres paquetes y un contrato compartido

```
freechords/
├─ apps/web/            # React + Vite + TypeScript + Tailwind
├─ apps/server/         # Express + TypeScript
├─ packages/chords/     # modelo canónico, parser, notación, trasposición
├─ services/analyzer/   # FastAPI + Essentia
├─ docker-compose.yml
└─ pnpm-workspace.yaml
```

`packages/chords` es TypeScript puro y sin dependencias de DOM, consumido por web y server (el server lo usa para normalizar y validar la salida del analizador). Se prueba de forma aislada con Vitest.

*Alternativa descartada*: repositorios separados. Añade coordinación de versiones sin beneficio en un proyecto de un solo equipo.

*Alternativa descartada*: Next.js. El usuario eligió Express; además los trabajos largos encajan mejor en un proceso Node dedicado que en funciones serverless.

### 2. Modelo canónico de acorde

```ts
type PitchClass = 0 | 1 | ... | 11;          // 0 = C
type Quality =
  | 'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'power'
  | '6' | 'm6' | '7' | 'maj7' | 'm7' | 'dim7' | 'm7b5' | '7sus4'
  | 'add9' | '9' | 'maj9' | 'm9' | '11' | 'm11' | '13' | 'm13' | '6/9';

interface Chord {
  root: PitchClass;
  quality: Quality;
  bass?: PitchClass;      // solo si difiere de root
  raw?: string;           // etiqueta original, solo depuración
}

interface ChordSegment {
  start: number;          // segundos, decimales
  end: number;
  chord: Chord | null;    // null = silencio / sin acorde
  confidence?: number;    // 0..1
}
```

Los símbolos de cualidad no se traducen entre idiomas: solo cambia el nombre de la fundamental (`C` ↔ `Do`). Esto evita ambigüedades como `M`/`m` y mantiene el cifrado reconocible para músicos de ambos idiomas.

*Alternativa descartada*: guardar la etiqueta como string y transformarla con expresiones regulares en cada render. Impide trasponer con seguridad y complica la edición.

### 3. Pipeline de análisis en dos procesos

```
Cliente ──POST /api/analyses──► Express
                                  │ 1. valida entrada (Zod) y límites
                                  │ 2. encola trabajo (concurrencia 2)
                                  │ 3. yt-dlp -f bestaudio → contenedor
                                  │ 4. ffmpeg → WAV mono 22 050 Hz
                                  │ 5. POST /analyze (FastAPI)
                                  ▼
                              Essentia
                                  │ HPCP + ChordsDetectionBeats
                                  │ (fallback ChordsDetection)
                                  ▼
                            segmentos crudos
                                  │ 6. normalización en Express
                                  ▼
                            resultado + TTL 24 h
Cliente ──GET /api/analyses/:id (polling 1 s)──► estado/resultado
```

- **Essentia** se elige por precisión y mantenimiento frente a madmom (sin mantenimiento activo) y frente a un analizador JS (precisión insuficiente para acordes reales).
- **ChordsDetectionBeats** aprovecha la detección de pulso de `RhythmExtractor2013`; si falla, se usa `ChordsDetection` con ventana fija (4 096 muestras, salto 2 048). Ambos sobre HPCP de 12 bins.
- La **normalización** vive en Express, no en Python: fusiona segmentos iguales consecutivos, elimina segmentos menores de 0,25 s, convierte `N` en `null`, recorta al rango `[0, duration]` y valida invariantes (orden, no solapamiento).
- El **analizador es stateless** y recibe un archivo por petición; no conoce YouTube ni el almacenamiento del cliente.

*Alternativa descartada*: análisis en el navegador con Web Audio + Meyda. La extracción de audio de YouTube desde el cliente no es viable y la precisión sería baja.

*Alternativa descartada*: cola con Redis/BullMQ. Innecesaria para una sola instancia; se encapsula la cola en una interfaz para poder sustituirla si escala.

### 4. API y modelo de trabajos

```
POST /api/analyses
  Content-Type: application/json   { "youtubeUrl": "..." }
  Content-Type: multipart/form-data  file=<audio>
  → 202 { "id": "<uuid>", "status": "queued" }

GET /api/analyses/:id
  → 200 {
      "id": "...", "status": "queued|processing|done|error",
      "progress": 0..100,
      "result": {
        "source": { "type": "youtube", "videoId": "..." } |
                  { "type": "upload", "filename": "..." },
        "duration": 213.4,
        "segments": [ { "start": 0, "end": 4.2,
                        "chord": { "root": 9, "quality": "minor" } } ],
        "analyzerVersion": "essentia-1.0",
        "createdAt": "2026-10-29T..."
      },
      "error": { "code": "VIDEO_UNAVAILABLE", "message": "..." }
    }

GET /api/health → 200 { "status": "ok", "analyzer": "ok|down" }
```

Códigos de error estables: `INVALID_URL`, `UNSUPPORTED_HOST`, `DURATION_EXCEEDED`, `FILE_TOO_LARGE`, `INVALID_AUDIO`, `VIDEO_UNAVAILABLE`, `ANALYSIS_FAILED`, `RATE_LIMITED`, `NOT_FOUND`.

El **polling** se elige frente a SSE/WebSocket por simplicidad y porque el progreso granular no es crítico. La caché en memoria del servidor se indexa por `videoId + analyzerVersion`; las subidas no se cachean por contenido.

### 5. Extracción de audio y seguridad

- Solo se acepta un **ID de video** validado con `^[A-Za-z0-9_-]{11}$`; nunca se pasa la URL del usuario a `yt-dlp`. Esto elimina inyección de argumentos y buena parte del riesgo de SSRF.
- `yt-dlp --no-playlist --no-warnings -f bestaudio -o <tmp>/%(id)s.%(ext)s`, con timeout de 90 s y `--match-filter "duration < 900"` como segunda barrera tras consultar metadatos.
- `ffmpeg -i input -ac 1 -ar 22050 -f wav output.wav`, con timeout de 60 s.
- Subidas: `multer` en memoria con límite de 25 MB, validación por firma de archivo y `ffprobe` (duración, códec, canales) antes de aceptar.
- Rate limit por IP con `express-rate-limit` (5 análisis/hora por defecto, configurable).
- Los temporales se crean en un directorio por trabajo y se eliminan en `finally`; un barrido periódico elimina restos de más de una hora.
- Cabeceras de seguridad con `helmet`; CORS restringido al origen del frontend.

### 6. Sincronización de la rejilla

El cliente define una interfaz `PlayerAdapter` con `getCurrentTime()`, `seekTo(seconds)`, `play()`, `pause()` y `onStateChange`. Dos implementaciones: YouTube IFrame API y `HTMLAudioElement`.

Un bucle `requestAnimationFrame` solo activo durante la reproducción lee el tiempo actual, localiza el segmento con búsqueda binaria sobre `start` y actualiza el índice activo. El estado se publica en React con `useSyncExternalStore` para evitar re-renders de toda la lista; solo cambian la fila activa y el anuncio accesible.

*Alternativa descartada*: `timeupdate` del elemento `<audio>` (4 Hz, insuficiente) y temporizadores `setInterval` (deriva y se detiene en pestañas en segundo plano).

### 7. Notación, trasposición y ortografía

- La trasposición opera sobre clases de altura: `(pc + n + 12) % 12`.
- La **tonalidad estimada** se obtiene en el cliente a partir de un histograma de fundamentales ponderado por duración, comparado con los perfiles de Krumhansl-Schmuckler. Con la tonalidad se elige el conjunto de alteraciones (sostenidos o bemoles) y se escribe la nota.
- Si la estimación es ambigua, se usa la preferencia del usuario y, en su defecto, sostenidos.
- La preferencia (`english|spanish`, `sharp|flat|auto`) se guarda en la biblioteca y en una clave de preferencias separada.

*Alternativa descartada*: fijar siempre sostenidos. Produce cifrados incorrectos en tonalidades como Fa mayor o Si bemol.

### 8. Edición como lista inmutable de segmentos

Cada operación (cambiar acorde, mover límite, dividir, fusionar) produce un nuevo array y se apila en un historial con límite de 50 entradas. Una función `normalizeSegments` repara invariantes tras cada operación: orden, no solapamiento, duración mínima y cobertura hasta la duración del audio.

La versión detectada original se conserva aparte (`detectedSegments`) para poder restaurarla.

### 9. Persistencia local

Claves separadas para evitar reescrituras grandes:

```
freechords:v1:preferences            → { notation, accidentalPreference, transpose }
freechords:v1:library                → { schemaVersion: 1, songs: SongSummary[] }
freechords:v1:song:<songId>          → { schemaVersion: 1, song: Song }
freechords:v1:analysis:<cacheKey>    → { schemaVersion: 1, result: AnalysisResult }
```

- `cacheKey = hash(sourceKey + analyzerVersion)`, donde `sourceKey` es `yt:<videoId>` o `upload:<sha256>`.
- Escritura con `try/catch` sobre `QuotaExceededError`; ante fallo se ofrece purgar caché de análisis (LRU por `lastAccessedAt`).
- Al arrancar, un lector tolerante valida el sobre; si falla, mueve el contenido a `freechords:v1:corrupt:<timestamp>` y arranca vacío.
- Migraciones por `schemaVersion` con funciones puras y tests por versión.

*Alternativa descartada*: IndexedDB. Permitiría más cuota, pero añade complejidad y el volumen esperado (decenas de canciones) cabe en `localStorage`.

### 10. Pruebas y despliegue

- **Unitarias (Vitest)**: parser de acordes, trasposición, ortografía, normalización de segmentos, búsqueda binaria, migraciones.
- **Integración (Vitest + supertest)**: validación de entrada, límites, estados del trabajo y mapeo de errores, con `yt-dlp` y el analizador simulados.
- **Analizador (pytest)**: fixtures de audio cortos con acordes conocidos y comprobación de tolerancia.
- **E2E (Playwright)**: flujo completo con un resultado de análisis fijado y un adaptador de reproductor falso; edición, guardado y recarga.
- **Despliegue**: `docker-compose` con `web` (build estático servido por Express), `server` (incluye `yt-dlp` y `ffmpeg`) y `analyzer` (imagen Python con Essentia). Healthchecks y reinicio automático.

## Risks / Trade-offs

- **Términos de Servicio de YouTube**: descargar audio puede contravenir sus términos y provocar bloqueos por IP. → Aviso explícito en la UI, vía alternativa de subida, sin uso de cookies ni elusión de restricciones, y mensajes de error claros cuando la descarga falla.
- **Essentia es AGPL-3.0**: su uso en red obliga a publicar el código del servicio. → Decidir la licencia del proyecto (AGPL-3.0) o aislar el analizador como servicio separado con su propia licencia antes de distribuir; documentarlo en `README`.
- **Precisión limitada en armonía compleja**: acordes alterados, inversiones y tonalidades con modulación producen errores. → Edición manual como válvula de escape, confianza por segmento y fusión conservadora.
- **`yt-dlp` se rompe con cambios de YouTube**: → Versión fijada en la imagen, actualización periódica documentada y fallback de subida.
- **Cuota de `localStorage` (~5 MB)**: → Claves separadas, caché LRU purgable y aviso al usuario.
- **Reproductor no embebible o video privado**: → Estado de error con enlace para abrir en YouTube y opción de analizar un audio propio.
- **Coste de CPU del análisis**: → Duración máxima, concurrencia limitada a 2, timeouts y rechazo temprano por metadatos.

## Migration Plan

Proyecto greenfield: no hay datos ni código que migrar.

1. Desplegar `analyzer` y verificar `/health` con un audio de prueba.
2. Desplegar `server` con `yt-dlp` y `ffmpeg`; verificar `/api/health`.
3. Publicar `web` y comprobar el flujo de extremo a extremo con un video corto.
4. Rollback: conservar la imagen anterior por etiqueta; la caché del cliente incluye `analyzerVersion`, por lo que un cambio de versión invalida resultados sin romper la biblioteca.

## Open Questions

- Confirmar si el proyecto se distribuirá bajo AGPL-3.0 (compatible con Essentia) o si el analizador se mantendrá como servicio separado con licencia propia.
- Definir el destino de despliegue (VPS con Docker, Fly.io, Railway) para ajustar límites de CPU y almacenamiento temporal.
