# 02 — Casos de uso

Actores:

- **Usuario local:** usa la app/escritorio sin cuenta.
- **Usuario aprobado:** inicia sesión con Google en una instancia online y está en la allowlist.
- **Administrador:** usuario aprobado que además está en `ADMIN_EMAILS`.
- **Operador:** persona que despliega y mantiene la instancia (puede ser el mismo administrador).
- **Sistemas externos:** Google Identity, YouTube/yt-dlp, LRCLIB, Cloud Run, Firestore.

---

## CU-001 — Analizar una canción de YouTube

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado; YouTube; analyzer |
| Precondiciones | La app está abierta y el backend está disponible |
| Postcondiciones | Existe un job completado y la canción puede guardarse |

**Flujo principal**

1. El usuario pega un enlace o elige un resultado de búsqueda.
2. La SPA valida el formato y llama a `POST /api/analyses`.
3. El servidor crea el job, responde `202` y empieza a procesarlo.
4. El servidor obtiene metadatos, descarga audio, lo convierte y llama al analyzer.
5. La SPA hace polling hasta `done` y muestra la hoja de acordes.

**Alternativas**

- 2a. Si el video ya fue analizado con la misma versión del analyzer, se reutiliza el job.
- 5a. El usuario puede cancelar; la SPA llama a `DELETE /api/analyses/:id`.

**Excepciones**

- 2b. URL inválida → `INVALID_URL` / `MISSING_VIDEO_ID`.
- 2c. Límite de peticiones → `429 RATE_LIMITED`.
- 4a. Video no disponible → `VIDEO_UNAVAILABLE`.
- 4b. Duración superior a `MAX_DURATION_SECONDS` → `DURATION_EXCEEDED`.
- 4c. Fallo del analyzer → `ANALYSIS_FAILED`.

---

## CU-002 — Analizar un archivo de audio

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado; analyzer |
| Precondiciones | El archivo tiene una extensión y firma válidas |
| Postcondiciones | Job completado con la hoja de acordes |

**Flujo principal**

1. El usuario selecciona un archivo.
2. La SPA envía `multipart/form-data` a `POST /api/analyses`.
3. El servidor valida extensión, firma y tamaño.
4. Convierte a WAV, llama al analyzer y normaliza la respuesta.
5. La SPA hace polling y muestra el resultado.

**Excepciones**

- 2a. Archivo demasiado grande → `413 FILE_TOO_LARGE`.
- 3a. Formato no soportado → `422 INVALID_AUDIO`.
- 3b. El archivo no parece audio → `INVALID_AUDIO`.
- 4a. Duración excedida → `DURATION_EXCEEDED`.

---

## CU-003 — Buscar en YouTube por nombre

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado; yt-dlp |
| Precondiciones | Hay conexión a Internet |
| Postcondiciones | Lista de hasta 10 resultados con miniatura y duración |

**Flujo principal**

1. El usuario escribe una consulta de 1–120 caracteres.
2. La SPA llama a `GET /api/youtube/search?q=...`.
3. El servidor ejecuta `ytsearch10:` con yt-dlp y filtra directos/upcoming.
4. Devuelve `{ results: [...] }`.

**Excepciones**

- 1a. Consulta vacía o demasiado larga → `INVALID_REQUEST`.
- 3a. yt-dlp falla → `SEARCH_FAILED`.
- 2a. Más de 30 búsquedas por minuto → `RATE_LIMITED`.

---

## CU-004 — Editar una canción

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado |
| Precondiciones | La canción está abierta |
| Postcondiciones | Cambios guardados en la copia local y, si aplica, en la nube |

**Flujo principal**

1. El usuario cambia un acorde, añade letra, ajusta el capo, transpone o cambia la notación.
2. La SPA actualiza el estado y recalcula la presentación con `packages/chords`.
3. Al guardar, escribe la canción en `localStorage` con un nuevo `updatedAt`.
4. En modo online, el debounce de sincronización envía el snapshot a Firestore.

**Alternativas**

- 4a. El usuario puede pulsar **Sync now** para forzar el envío.
- 2a. La vista previa no modifica los segmentos originales; el editor conserva el cifrado
  detectado.

**Excepciones**

- 3a. Cuota de `localStorage` → `StorageQuotaError` y aviso.
- 4b. Fallo de red → estado `error`; la copia local sigue intacta.

---

## CU-005 — Practicar un tramo A–B

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado |
| Precondiciones | Hay una canción abierta con pulsos/compases |
| Postcondiciones | Reproducción del tramo o bucle activo |

**Flujo principal**

1. El usuario arma A o B y pulsa un compás.
2. La SPA fija el extremo sin reproducir.
3. Al pulsar Play, empieza en A y se detiene en B (o hace bucle).
4. El usuario puede cambiar tempo, tono y transposición.

**Alternativas**

- 1a. Sin A/B armados, un clic busca ese punto y reproduce desde ahí.
- 1b. El hover previsualiza el compás.

**Excepciones**

- 3a. El navegador bloquea la reproducción automática → el usuario debe pulsar Play.
- 3b. El audio temporal de YouTube no está listo → `AUDIO_NOT_READY`.

---

## CU-006 — Gestionar la biblioteca local

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado |
| Precondiciones | La app está abierta |
| Postcondiciones | Biblioteca actualizada en `localStorage` |

**Flujo principal**

1. El usuario abre la biblioteca.
2. Busca, filtra por fuente, abre o elimina canciones.
3. La SPA actualiza los resúmenes y el historial de apertura.

**Excepciones**

- 2a. Datos corruptos → se mueven a `chordifree:v1:corrupt:*` y se avisa.
- 2b. Cuota llena → aviso y purga de caché de análisis.

---

## CU-007 — Gestionar setlists

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado |
| Precondiciones | Existe al menos una canción |
| Postcondiciones | Setlist creada, renombrada, reordenada o eliminada |

**Flujo principal**

1. El usuario crea una setlist con un nombre.
2. Añade canciones, las reordena o las quita.
3. La SPA guarda la lista con `updatedAt`.

**Excepciones**

- 2a. Canción inexistente → se ignora al abrir la setlist.
- 3a. Cuota llena → `StorageQuotaError`.

---

## CU-008 — Iniciar sesión con Google

| Campo | Contenido |
|---|---|
| Actores | Usuario aprobado; Google Identity |
| Precondiciones | `AUTH_MODE=google`, cliente OAuth configurado y origen autorizado |
| Postcondiciones | Sesión con ID token y usuario verificado |

**Flujo principal**

1. `AuthProvider` llama a `GET /api/auth/config`.
2. La SPA carga Google Identity Services y muestra el botón.
3. Google devuelve un ID token.
4. La SPA guarda el token en `sessionStorage` y llama a `GET /api/auth/me`.
5. El servidor verifica el token, comprueba la allowlist y responde `{ user, allowed, admin }`.

**Alternativas**

- 5a. Si la cuenta no está permitida, la SPA muestra la pantalla de acceso restringido.
- 5b. El administrador siempre está permitido por `ADMIN_EMAILS`.

**Excepciones**

- 2a. Origen no autorizado → Google bloquea el botón.
- 4a. Token inválido o caducado → `401 UNAUTHENTICATED`.
- 5a. Cuenta no permitida → `403 NOT_ALLOWED`.

---

## CU-009 — Gestionar la allowlist

| Campo | Contenido |
|---|---|
| Actores | Administrador |
| Precondiciones | Sesión válida y email en `ADMIN_EMAILS` |
| Postcondiciones | La lista de acceso cambia en Firestore |

**Flujo principal**

1. El administrador abre `#/admin`.
2. La SPA llama a `GET /api/admin/access`.
3. Añade un email con `POST /api/admin/access`.
4. Elimina un email con `DELETE /api/admin/access/:email`.

**Excepciones**

- 1a. Usuario no administrador → `403 ADMIN_ONLY`.
- 3a. Email inválido → `INVALID_REQUEST`.
- 4a. Email no encontrado → `NOT_FOUND`.

---

## CU-010 — Sincronizar la biblioteca con la nube

| Campo | Contenido |
|---|---|
| Actores | Usuario aprobado; Firestore |
| Precondiciones | Sesión válida y `AUTH_MODE=google` |
| Postcondiciones | Snapshot del usuario actualizado en Firestore |

**Flujo principal**

1. Al autenticarse, la SPA llama a `GET /api/cloud/library`.
2. Fusiona canciones por `sourceKey` y setlists por `updatedAt`.
3. Guarda el resultado localmente y hace `PUT /api/cloud/library`.
4. Los cambios posteriores se envían con debounce (1,2 s).

**Alternativas**

- 4a. **Sync now** fuerza un envío inmediato.
- 2a. Si no hay datos en nube, se sube la biblioteca local.

**Excepciones**

- 1a. Endpoint deshabilitado → `404 CLOUD_DISABLED`.
- 1b. Sin sesión → `401 UNAUTHENTICATED`.
- 3a. Payload inválido → `400 INVALID_REQUEST`.
- 4b. Fallo de red → estado `error`; se reintenta en el siguiente cambio.

---

## CU-011 — Preparar audio temporal para el reproductor

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado; yt-dlp |
| Precondiciones | Canción de YouTube analizada |
| Postcondiciones | Archivo temporal disponible para el reproductor con pitch |

**Flujo principal**

1. La SPA llama a `POST /api/youtube/:videoId/audio`.
2. El servidor descarga/cachea el audio y devuelve `{ url, expiresAt }`.
3. La SPA reproduce con `GET /api/youtube/:videoId/audio` (soporta rangos).

**Excepciones**

- 2a. El audio no está listo → `404 AUDIO_NOT_READY`.
- 2b. Demasiadas peticiones → `RATE_LIMITED`.
- 3a. El archivo temporal expiró → `AUDIO_NOT_READY`.

---

## CU-012 — Obtener letras

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado; LRCLIB |
| Precondiciones | Hay título y, opcionalmente, artista y duración |
| Postcondiciones | Letra pegada en el editor para revisión |

**Flujo principal**

1. La SPA llama a `GET /api/lyrics?title=...&artist=...&duration=...`.
2. El servidor consulta LRCLIB y elige la mejor coincidencia.
3. Devuelve letra plana y, si existe, sincronizada.

**Excepciones**

- 2a. Sin resultados → `LYRICS_NOT_FOUND`.
- 2b. LRCLIB caído o respuesta inválida → `LYRICS_UNAVAILABLE`.
- 2c. LRCLIB limita → `RATE_LIMITED`.

---

## CU-013 — Exportar e importar la biblioteca

| Campo | Contenido |
|---|---|
| Actores | Usuario local / aprobado |
| Precondiciones | La app está abierta |
| Postcondiciones | Copia JSON o ChordPro creada/restaurada |

**Flujo principal**

1. El usuario exporta un backup JSON o una hoja ChordPro.
2. En la importación, la SPA detecta el formato.
3. Valida el snapshot, fusiona canciones y actualiza la biblioteca.

**Excepciones**

- 3a. JSON inválido → `BackupError`.
- 3b. ChordPro inválido → `ChordProError`.
- 3c. Cuota llena → aviso.

---

## CU-014 — Desplegar y operar la instancia online

| Campo | Contenido |
|---|---|
| Actores | Operador; Google Cloud |
| Precondiciones | Proyecto con facturación, OAuth client y credenciales |
| Postcondiciones | Cloud Run, Firestore y Artifact Registry operativos |

**Flujo principal**

1. El operador rellena `terraform.tfvars`.
2. Ejecuta `./deploy.sh`.
3. Terraform crea la infraestructura y Cloud Build publica las imágenes.
4. El operador añade la URL a los orígenes OAuth.
5. El administrador entra y gestiona la allowlist.

**Excepciones**

- 2a. API de facturación deshabilitada → fallo de Terraform.
- 3a. Error de permisos de Cloud Build/IAM → revisar roles.
- 4a. Origen OAuth ausente → Google bloquea el login.

---

## CU-015 — Borrar los datos online y la cuenta

| Campo | Contenido |
|---|---|
| Actores | Usuario aprobado / administrador; Firestore |
| Precondiciones | Sesión válida y cuenta permitida |
| Postcondiciones | Canciones y setlists borrados; el no administrador pierde el acceso |

**Flujo principal**

1. El usuario abre el menú de cuenta y elige **Delete cloud data**.
2. La SPA pide confirmación y explica que la copia local permanece.
3. La SPA llama a `DELETE /api/account`.
4. El servidor borra `chordifree_users/{uid}/songs` y `.../setlists`.
5. Si el usuario no es administrador, elimina también su entrada de `chordifree_access`.
6. La SPA muestra el resultado; si se quitó el acceso, cierra la sesión.

**Alternativas**

- 5a. Un administrador conserva el acceso porque está en `ADMIN_EMAILS`; solo se borran sus
  datos.
- 1a. El usuario puede seguir usando la copia local y volver a subirla si mantiene el acceso.

**Excepciones**

- 3a. Modo local / nube deshabilitada → `404 CLOUD_DISABLED`.
- 3b. Token inválido → `401 UNAUTHENTICATED`.
- 3c. Cuenta fuera de la allowlist → `403 NOT_ALLOWED`.
- 4a. Fallo de Firestore → 500; no se elimina la entrada de acceso.
