# Tasks

## 1. Estructura y tooling

- [x] 1.1 Crear el workspace de pnpm con `apps/web`, `apps/server`, `packages/chords` y `services/analyzer`; verificar con `pnpm -r exec pwd` que los cuatro paquetes se resuelven.
- [x] 1.2 Configurar TypeScript en modo estricto, ESLint, Prettier y Vitest en la raíz; verificar que `pnpm lint` y `pnpm test` terminan sin errores sobre un test de humo.
- [x] 1.3 Crear `tsconfig.base.json` y alias `@freechords/chords`; verificar que `apps/web` y `apps/server` compilan importando un tipo del paquete compartido.
- [x] 1.4 Añadir `.env.example`, `.gitignore` y un `docker-compose.yml` esqueleto; verificar con `docker compose config` que la configuración es válida.
- [x] 1.5 Escribir el `README.md` con requisitos (Node 20+, pnpm, Python 3.11+, ffmpeg, yt-dlp) y comandos de desarrollo; verificar ejecutando cada comando documentado en una copia limpia.

## 2. Modelo canónico de acordes

- [x] 2.1 Definir `PitchClass`, `Quality`, `Chord` y `ChordSegment` en `packages/chords`; verificar que los tipos se exportan y compilan.
- [x] 2.2 Implementar el parser de etiquetas en notación inglesa y española (`C`, `Am`, `F#m7`, `Do`, `Lam`, `Fa#`, `C/G`, `N`); verificar con tests unitarios por cada forma.
- [x] 2.3 Implementar el formateador en notación inglesa; verificar `Am`, `Cmaj7`, `C/G` con tests unitarios.
- [x] 2.4 Implementar el formateador en notación española (`Lam`, `Domaj7`, `Fa#`); verificar que las cualidades no se traducen con tests unitarios.
- [x] 2.5 Implementar la trasposición de fundamental y bajo con envolvente modular; verificar los casos `B + 1 = C`, `C/G + 2 = D/A` y el rango -11..+11.
- [x] 2.6 Implementar la estimación de tonalidad por histograma ponderado y la elección de sostenidos/bemoles; verificar que Fa mayor produce `Bb` y que la preferencia forzada la anula.
- [x] 2.7 Implementar `normalizeSegments` (orden, no solapamiento, duración mínima, fusión de iguales, recorte a duración); verificar las invariantes con tests y casos límite.
- [x] 2.8 Añadir tests de propiedades para trasposición ida y vuelta y para el parser; verificar con `pnpm --filter @freechords/chords test`.

## 3. Servicio analizador

- [x] 3.1 Crear el esqueleto FastAPI con `GET /health` y configuración por entorno; verificar con `curl localhost:8000/health`.
- [ ] 3.2 Escribir el `Dockerfile` del analizador con Python 3.11, Essentia y ffmpeg; verificar que la imagen construye y responde a `/health`.
- [x] 3.3 Implementar la extracción de HPCP y `ChordsDetectionBeats` con fallback a `ChordsDetection`; verificar con un audio de prueba que devuelve segmentos.
- [x] 3.4 Definir el contrato de respuesta (`segments`, `duration`, `analyzerVersion`) y validarlo en el servicio; verificar que una petición inválida devuelve 422.
- [x] 3.5 Crear fixtures de audio sintético con acordes conocidos y tests de tolerancia por duración detectada; verificar con `pytest`.
- [x] 3.6 Documentar la API del analizador en `services/analyzer/README.md`; verificar que el ejemplo `curl` del documento funciona contra el contenedor.

## 4. API de análisis

- [x] 4.1 Crear la app Express con `helmet`, CORS restringido, logger y `GET /api/health`; verificar con supertest que responde `200` y comprueba el analizador.
- [x] 4.2 Definir los esquemas Zod de entrada (URL de YouTube y metadatos de subida); verificar que entradas inválidas devuelven `400` con el código estable correspondiente.
- [x] 4.3 Implementar el almacén de trabajos en memoria y la cola con concurrencia 2 y progreso; verificar con tests que dos trabajos se ejecutan y el resto espera en `queued`.
- [x] 4.4 Implementar `POST /api/analyses` para enlaces de YouTube; verificar que devuelve `202` con `id` y `status: queued`.
- [x] 4.5 Implementar `POST /api/analyses` para `multipart/form-data`; verificar que un audio válido crea el trabajo y que un archivo no audio devuelve `INVALID_AUDIO`.
- [x] 4.6 Implementar `GET /api/analyses/:id` con estados, resultado y errores; verificar `queued`, `done` y `NOT_FOUND` con supertest.
- [x] 4.7 Implementar el mapeo de errores a códigos estables (`VIDEO_UNAVAILABLE`, `ANALYSIS_FAILED`, etc.); verificar cada código con tests.
- [x] 4.8 Añadir rate limiting configurable por IP; verificar que la petición que excede el límite devuelve `429` con `Retry-After`.
- [x] 4.9 Escribir tests de integración con `yt-dlp` y el analizador simulados; verificar con `pnpm --filter @freechords/server test`.
- [x] 4.10 Documentar la API en `apps/server/README.md` con ejemplos y códigos de error; verificar que los ejemplos coinciden con los tests de integración.

## 5. Ingesta de audio y seguridad

- [x] 5.1 Implementar el wrapper de `yt-dlp` que acepta solo un ID validado (`^[A-Za-z0-9_-]{11}$`), con timeout de 90 s; verificar con un test que una URL maliciosa no se pasa al binario.
- [x] 5.2 Consultar metadatos y rechazar videos de más de 15 minutos antes de descargar; verificar con un fixture de metadatos que devuelve `DURATION_EXCEEDED`.
- [x] 5.3 Implementar la conversión con ffmpeg a WAV mono 22 050 Hz con timeout de 60 s; verificar que un audio estéreo de prueba produce un WAV mono válido.
- [x] 5.4 Implementar la validación de subidas con `multer` (25 MB), firma de archivo y `ffprobe`; verificar que un archivo falso se rechaza antes de analizarse.
- [x] 5.5 Crear directorios temporales por trabajo y eliminarlos en `finally`, con barrido de restos de más de una hora; verificar que tras un fallo simulado no quedan archivos.
- [x] 5.6 Escribir tests con binarios falsos para los caminos de éxito, timeout y error de `yt-dlp`/`ffmpeg`; verificar con la suite del servidor.
- [x] 5.7 Añadir tests de seguridad para inyección de argumentos, hosts no permitidos y rutas de archivo; verificar que todos los intentos devuelven error de validación.

## 6. Shell del frontend y reproductores

- [x] 6.1 Crear la app Vite + React + TypeScript + Tailwind con layout base y estados de carga; verificar con `pnpm --filter @freechords/web dev` y `build`.
- [x] 6.2 Implementar el cliente HTTP y el hook de polling de análisis con cancelación; verificar con tests que los estados `queued`/`done`/`error` se reflejan.
- [x] 6.3 Definir la interfaz `PlayerAdapter` y un adaptador falso para tests; verificar con tests unitarios de `getCurrentTime` y `seekTo`.
- [x] 6.4 Implementar el adaptador de YouTube IFrame API (carga, eventos, seek); verificar manualmente con un video público y con un test del envoltorio.
- [x] 6.5 Implementar el adaptador de `HTMLAudioElement` para audios subidos; verificar reproducción, pausa y búsqueda en un archivo local.
- [x] 6.6 Construir la pantalla de inicio con entrada de URL, subida de archivo y estados de progreso; verificar el flujo con el analizador simulado.
- [x] 6.7 Implementar los estados de error (video no embebible, análisis fallido, límite excedido) con acciones de reintento; verificar cada estado con tests de componente.

## 7. Rejilla sincronizada

- [x] 7.1 Implementar el componente de rejilla con tiempo `mm:ss`, acorde y marca de silencio; verificar con tests de render para una línea de tiempo fija.
- [x] 7.2 Implementar la búsqueda binaria del segmento activo; verificar bordes (inicio, fin, hueco, lista vacía) con tests unitarios.
- [x] 7.3 Implementar el bucle `requestAnimationFrame` y el store externo con `useSyncExternalStore`; verificar que solo se re-renderiza la fila activa con un test de contador de renders.
- [x] 7.4 Añadir autoscroll que mantiene visible el acorde activo sin saltos al hacer scroll manual; verificar con un test de componente y revisión visual.
- [x] 7.5 Implementar el salto al inicio del segmento al hacer clic o pulsar Intro; verificar con el adaptador falso que `seekTo` recibe el tiempo correcto.
- [x] 7.6 Añadir navegación por teclado y región `aria-live` para el acorde activo; verificar con tests de accesibilidad y lector de pantalla.

## 8. Notación y trasposición en la interfaz

- [x] 8.1 Añadir el selector de notación inglesa/española que reescribe la rejilla sin reanalizar; verificar que la reproducción continúa en el mismo tiempo.
- [x] 8.2 Añadir los controles de trasposición -11..+11 con reinicio a 0; verificar que los acordes y la reproducción se mantienen coherentes.
- [x] 8.3 Añadir el selector de preferencia enarmónica (auto, sostenidos, bemoles); verificar que auto usa la tonalidad estimada y las opciones forzadas la anulan.
- [x] 8.4 Persistir notación, preferencia y trasposición en `freechords:v1:preferences`; verificar que se restauran al recargar.
- [x] 8.5 Escribir tests de componente para los tres controles; verificar con `pnpm --filter @freechords/web test`.

## 9. Editor de corrección

- [x] 9.1 Implementar el modo de edición con acciones de guardar y descartar; verificar que descartar restaura el estado previo.
- [x] 9.2 Implementar la edición del acorde con validación en notación inglesa y española; verificar que `H7` se rechaza y `A7` se acepta.
- [x] 9.3 Implementar el ajuste de inicio y fin con recorte del segmento vecino y rechazo de rangos inválidos; verificar que no se crean solapamientos.
- [x] 9.4 Implementar dividir y fusionar segmentos adyacentes; verificar que la fusión no se ofrece para segmentos no contiguos.
- [x] 9.5 Implementar el historial de deshacer/rehacer con límite de 50 entradas; verificar el orden inverso con tests.
- [x] 9.6 Conservar la versión detectada y permitir restaurarla con confirmación; verificar que tras restaurar se muestran los acordes originales.
- [x] 9.7 Escribir tests del editor (unidad y componente); verificar con la suite del frontend.

## 10. Biblioteca local y caché

- [x] 10.1 Implementar el envoltorio de almacenamiento versionado con lectura tolerante; verificar con datos válidos, ausentes y corruptos.
- [x] 10.2 Implementar el CRUD de canciones (guardar, listar por última modificación, abrir, eliminar con confirmación); verificar cada operación con tests.
- [x] 10.3 Implementar la caché de análisis por `sourceKey + analyzerVersion`; verificar que un segundo análisis del mismo video no llama al servidor.
- [x] 10.4 Implementar el manejo de `QuotaExceededError` con purga LRU de caché; verificar con un almacén simulado lleno.
- [x] 10.5 Implementar la recuperación ante datos corruptos moviendo el contenido a una clave de cuarentena; verificar que la app arranca vacía y avisa.
- [x] 10.6 Implementar migraciones por `schemaVersion`; verificar con fixtures de versiones anteriores y con una versión no compatible.
- [x] 10.7 Escribir tests de la biblioteca y de las migraciones; verificar con `pnpm --filter @freechords/web test`.

## 11. Integración y accesibilidad

- [x] 11.1 Configurar Playwright con un resultado de análisis fijado y un adaptador de reproductor falso; verificar que la suite arranca en CI local.
- [x] 11.2 Escribir el E2E del flujo completo (pegar URL, analizar, reproducir, trasponer, editar, guardar y recargar); verificar que pasa de principio a fin.
- [x] 11.3 Añadir una auditoría de accesibilidad con axe en las pantallas principales; verificar que no hay violaciones críticas.
- [x] 11.4 Medir la latencia de cambio de acorde con el adaptador falso; verificar que el resaltado se actualiza en menos de 250 ms.
- [ ] 11.5 Verificar el comportamiento en Chrome, Firefox y Safari; documentar las diferencias encontradas.

## 12. Despliegue y documentación operativa

- [x] 12.1 Configurar el build de producción del frontend servido por Express con cabeceras de caché; verificar con `docker compose up` y una petición a la raíz.
- [ ] 12.2 Escribir los `Dockerfile` de `web`/`server` con `yt-dlp` y `ffmpeg` fijados por versión; verificar que las imágenes construyen y pasan `/api/health`.
- [ ] 12.3 Completar `docker-compose.yml` con healthchecks, volúmenes temporales y variables de entorno; verificar que `docker compose up` levanta los tres servicios sanos.
- [x] 12.4 Documentar en `README.md` el aviso de Términos de Servicio de YouTube, la licencia AGPL-3.0 de Essentia, la configuración y la operación (logs, límites, limpieza); verificar que un lector puede desplegar siguiendo solo el documento.
- [x] 12.5 Añadir un script de smoke test que analice un audio de fixture y valide la línea de tiempo; verificar que se ejecuta contra el compose levantado.
- [x] 12.6 Registrar la decisión de licencia del proyecto (AGPL-3.0 o servicio separado) en `README.md` y en un `LICENSE`; verificar que la decisión es coherente con la distribución del analizador.

## Workflow follow-up

- Revisar los artefactos con el equipo antes de implementar.
- Archivar el cambio cuando la implementación y sus verificaciones estén completas.
