# Chordifree

Convierte un video musical de YouTube (o un audio propio) en una línea de tiempo de acordes
sincronizada con la reproducción. Permite trasponer ±11 semitonos y cambiar entre notación
inglesa (`C`, `Am`, `F#`) y española (`Do`, `Lam`, `Fa#`).

> **Aviso legal**: descargar audio de YouTube puede contravenir sus Términos de Servicio.
> Usa la vía de subida de audio cuando no tengas derechos sobre el contenido. Este proyecto
> no elude restricciones técnicas ni usa cookies de sesión.

## Vista de canción

La cabecera de la canción da paso a la barra de reproducción y a una barra de herramientas
superior con el mismo patrón que Chordify: un icono, la etiqueta en mayúsculas y el control o
valor debajo. Reúne la notación, las alteraciones, el transporte, la tonalidad estimada, la
presentación (simplificar, reducir y reducción máxima) y el instrumento. Así los controles de
presentación no ocupan espacio en la columna del video.

La línea de tiempo se presenta como una parrilla de ocho pulsos por fila (dos compases de
4/4) al estilo de Chordify: un canal lateral muestra el tiempo de inicio y el número del primer
compás de cada fila, y las celdas se separan por compás con una etiqueta de acorde solo donde
cambia el acorde. La agrupación empieza en el primer pulso detectado, así que la parrilla no
afirma dónde cae el downbeat musical; si el análisis no devuelve pulsos, la canción se abre en
la vista de lista.

En pantallas anchas la parrilla ocupa todo el espacio libre y las ocho columnas se reparten el
ancho, sin scroll horizontal. El video se limita a una columna compacta a la derecha, con
relación de aspecto 16:9 real (el iframe se ajusta al contenedor). Debajo del video, el acorde
activo muestra su diagrama; a continuación aparece el bloque de información de la canción:
tonalidad, BPM estimado, compás, duración, artista y la lista de acordes. Las alteraciones se
muestran con los símbolos `♭` y `♯` (`Si♭m`, `Fa♯`), tanto en notación inglesa como española.

Si los pulsos guardados de una canción antigua terminan antes que el audio, la parrilla
reconstruye la rejilla con el intervalo mediano para que la línea de tiempo no se corte. Esa
misma reconstrucción usa un tempo constante anclado en el primer pulso detectado, de modo que
las pequeñas irregularidades del analizador no hagan que las celdas se desalineen con la
canción.

- **Simplificar acordes**: reduce las tensiones, extensiones, suspensiones e inversiones a la
  tríada básica (`Cmaj7` → `C`, `C/G` → `C`) y conserva la séptima de dominante porque define
  la función armónica (`G7` → `G7`). Solo afecta a la presentación; el editor conserva el
  cifrado original. El analizador actual (Essentia `ChordsDetectionBeats`) devuelve sobre todo
  tríadas mayores y menores, así que en canciones de YouTube el cambio se nota cuando hay
  extensiones, suspensiones o inversiones.
- **Reducir acordes**: además de simplificar, agrupa acordes repetidos y absorbe los acordes de
  paso que duran una pulsación o menos cuando están rodeados de acordes más largos. Las
  progresiones que cambian en cada pulsación se conservan. Es reversible y no modifica la línea
  de tiempo guardada.
- **Reducción máxima**: parte de la reducción normal y deja como mucho un acorde por compás,
  conservando el que más suena dentro de él. Es útil para cifrados muy simplificados o para
  tocar acompañando; los silencios se respetan y tampoco modifica la línea de tiempo guardada.
- **Instrumento**: muestra la digitación de guitarra o ukelele, o el voicing de piano, del
  acorde activo y de cada acorde de la rejilla.
- **Dos columnas**: en pantallas anchas la rejilla ocupa la izquierda y el video ajustado al
  ancho de su columna, con el transporte y las herramientas, queda a la derecha; en pantallas
  estrechas se apilan con el video y las herramientas primero.
- **Tema claro u oscuro**: el tema claro es el inicial; el botón de la cabecera alterna el
  tema y la elección se conserva entre visitas.

## Requisitos

- Node.js 20 o superior y pnpm 9.
- Python 3.11 o superior (solo para el analizador).
- `ffmpeg` y `ffprobe` en el `PATH` del servidor.
- `yt-dlp` en el `PATH` del servidor.
- Docker y Docker Compose (opcional, para el despliegue completo).

## Estructura

```
apps/web/            SPA React + Vite + Tailwind
apps/server/         API Express + cola de análisis
packages/chords/     Modelo canónico, notación, trasposición y segmentos
services/analyzer/   Microservicio FastAPI + Essentia
```

## Desarrollo

```bash
pnpm install
cp .env.example .env

# Terminal 1: analizador (requiere Essentia y ffmpeg)
python3 -m venv .venv
. .venv/bin/activate
pip install -r services/analyzer/requirements.txt
uvicorn app.main:app --app-dir services/analyzer --port 8000

# Terminal 2: API y web
pnpm dev
```

La web queda en `http://localhost:5173` y la API en `http://localhost:3001`.
`pnpm dev` arranca Vite y el servidor Express; Vite redirige `/api` al backend.

## Scripts

| Comando          | Descripción                                            |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Web + API en modo desarrollo                           |
| `pnpm build`     | Build de producción de la web                          |
| `pnpm test`      | Tests unitarios y de integración de todos los paquetes |
| `pnpm test:e2e`  | Suite E2E de Playwright (Chromium, Firefox y WebKit)   |
| `pnpm smoke`     | Smoke test contra una API levantada (ver más abajo)    |
| `pnpm typecheck` | Comprobación de tipos                                  |
| `pnpm lint`      | ESLint                                                 |
| `pnpm format`    | Prettier                                               |

### Smoke test

El script sube `scripts/fixtures/chords.wav` (progresión C–F–G generada con
`scripts/fixtures/make-fixture.sh`) a la API y valida que la línea de tiempo esté ordenada, sin
solapamientos, con acordes canónicos y cubriendo la duración del audio.

```bash
# Con `pnpm dev` y el analizador en marcha:
pnpm smoke

# Contra otro despliegue:
API_URL=http://localhost:3001 pnpm smoke
```

El script termina con código distinto de cero si alguna invariante falla, por lo que sirve
como comprobación posterior a un despliegue (`docker compose up`).

## Variables de entorno

Ver `.env.example`. Las más relevantes:

- `ANALYZER_URL`: URL del microservicio (por defecto `http://localhost:8000`).
- `MAX_DURATION_SECONDS`: duración máxima analizable (900 s).
- `MAX_UPLOAD_BYTES`: tamaño máximo de subida (25 MB).
- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`: límite de análisis por IP.
- `YTDLP_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`: rutas a los binarios.

## Despliegue con Docker

```bash
docker compose up --build -d
```

Servicios y puertos:

| Servicio   | Puerto | Función                                                          |
| ---------- | ------ | ---------------------------------------------------------------- |
| `web`      | 3000   | Sirve el build estático con nginx y reenvía `/api` al servidor   |
| `server`   | 3001   | API Express, extracción con `yt-dlp`/`ffmpeg` y cola de trabajos |
| `analyzer` | 8000   | FastAPI + Essentia; solo debe ser accesible desde `server`       |

El contenedor `server` también sirve el build de la web si se ejecuta solo (por ejemplo, con
`pnpm build && pnpm --filter @chordifree/server start`), con caché inmutable para
`/assets/*` y `no-cache` para `index.html`. En Compose, nginx hace ese papel y el navegador
solo habla con `http://localhost:3000`.

Los tres servicios tienen `healthcheck` y `restart: unless-stopped`; `web` espera a que
`server` esté sano y `server` a que lo esté `analyzer`. Las versiones de `yt-dlp`
(`YTDLP_VERSION`) y de `ffmpeg`/`ffprobe` (`FFMPEG_IMAGE`) se fijan como argumentos de build
en `docker-compose.yml` y en los `Dockerfile`:

```bash
docker compose build \
  --build-arg YTDLP_VERSION=2026.10.26 \
  --build-arg FFMPEG_IMAGE=mwader/static-ffmpeg:7.1
```

Los temporales se guardan en el volumen `chordifree-tmp` (`/tmp/chordifree`), y la caché de
resultados vive en memoria con un TTL de 24 horas.

## Operación

### Logs y estado

```bash
docker compose ps
docker compose logs -f server analyzer
docker compose logs --tail=200 web
curl -fsS http://localhost:3001/api/health
```

`GET /api/health` devuelve `200` aunque el analizador esté caído; en ese caso
`{"status":"ok","analyzer":"down"}` permite detectar la dependencia sin tumbar la API.

### Límites

| Límite                       | Valor por defecto | Variable                                 |
| ---------------------------- | ----------------- | ---------------------------------------- |
| Duración máxima por análisis | 15 minutos        | `MAX_DURATION_SECONDS`                   |
| Tamaño máximo de subida      | 25 MB             | `MAX_UPLOAD_BYTES`                       |
| Análisis por IP              | 5 por hora        | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| Concurrencia de la cola      | 2 trabajos        | fija en esta versión                     |
| Timeout de descarga          | 90 s              | fijo                                     |
| Timeout de conversión        | 60 s              | fijo                                     |

Al superar el límite por IP la API responde `429 RATE_LIMITED` con `Retry-After`.

### Limpieza y caché

- Cada trabajo crea un directorio temporal propio y lo elimina en `finally`, también cuando
  falla.
- Un barrido cada 10 minutos elimina restos de más de una hora en `TEMP_DIR`.
- La caché del servidor está indexada por `videoId + analyzerVersion` y caduca a las 24 horas;
  un cambio de `ANALYZER_VERSION` invalida los resultados anteriores sin romper la biblioteca
  del cliente.
- En el navegador, la caché local se purga por LRU si `localStorage` se queda sin cuota.

### Actualizaciones

`yt-dlp` se rompe cuando YouTube cambia; actualiza `YTDLP_VERSION` a una versión reciente,
reconstruye la imagen y vuelve a desplegar. La vía de subida de audio sigue disponible como
alternativa.

## Compatibilidad de navegadores

La suite E2E se ejecuta con Chromium, Firefox y WebKit (el motor de Safari). Diferencias
conocidas:

- **WebKit/Safari**: el desplazamiento suave y `scrollIntoView({ block: 'nearest' })` pueden
  comportarse de forma distinta según la versión; la rejilla sigue actualizando el acorde
  activo, pero el autoscroll puede ser menos suave.
- **Firefox**: `localStorage` y la API de YouTube funcionan igual; el reproductor de YouTube
  puede requerir una interacción del usuario antes de reproducir audio, como en el resto de
  navegadores.
- **Todos**: la reproducción automática está limitada por las políticas del navegador; el
  usuario debe pulsar play una vez.

## Licencia

**Decisión: el proyecto se distribuye bajo AGPL-3.0** (texto completo en `LICENSE`).

El analizador usa [Essentia](https://essentia.upf.edu/), distribuida bajo AGPL-3.0. Como la
aplicación ofrece el analizador a través de la red, la AGPL exige publicar el código fuente de
la versión desplegada a los usuarios del servicio. Se elige la misma licencia para todo el
monorepo para mantener la coherencia y evitar dudas sobre la combinación de obras.

Si en el futuro se quiere distribuir el frontend o el servidor con otra licencia, la
alternativa prevista es mantener el analizador como servicio separado con su propia licencia
y comunicarlo mediante la red, revisando entonces este apartado y `LICENSE`.

## Aviso sobre YouTube

La descarga de audio puede contravenir los Términos de Servicio de YouTube y provocar bloqueos
por IP. La aplicación no usa cookies de sesión ni elude restricciones técnicas, y ofrece la
subida de audio como vía alternativa. Revisa los términos antes de desplegar el servicio.
