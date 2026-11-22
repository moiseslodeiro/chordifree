# 06 — Diagramas de estado

## Job de análisis

```mermaid
stateDiagram-v2
    [*] --> queued : POST /api/analyses
    queued --> processing : el worker toma la tarea
    processing --> done : resultado normalizado
    processing --> error : excepción / timeout / analyzer caído
    done --> [*] : TTL o DELETE
    error --> [*] : TTL o DELETE
    queued --> [*] : DELETE antes de empezar
    processing --> [*] : DELETE durante el proceso
```

| Estado | Significado |
|---|---|
| `queued` | Creado y esperando en `JobQueue`. |
| `processing` | Descarga/conversión/análisis en curso. |
| `done` | Tiene `result`; la SPA puede guardar la canción. |
| `error` | Tiene `error: { code, message }`. |

Notas:

- El estado vive en memoria; un reinicio lo pierde.
- `DELETE` elimina el job del `JobStore`; la tarea en curso comprueba que siga existiendo antes
  de escribir el resultado.

## Sesión de autenticación

```mermaid
stateDiagram-v2
    [*] --> loading : arranca la SPA
    loading --> authenticated : /api/auth/config = none
    loading --> signed_out : mode google sin token
    loading --> authenticated : token válido y allowlist
    loading --> denied : token válido pero cuenta no permitida
    loading --> signed_out : token inválido/expirado
    signed_out --> loading : Google devuelve credencial
    denied --> signed_out : sign out
    authenticated --> signed_out : 401 / sign out
```

| Estado | Significado |
|---|---|
| `loading` | Consultando configuración o verificando token. |
| `signed_out` | Sin sesión; se muestra el botón de Google. |
| `denied` | Google autenticó, pero la cuenta no está en la allowlist. |
| `authenticated` | Sesión válida; la app se renderiza. |

## Sincronización de biblioteca

```mermaid
stateDiagram-v2
    [*] --> idle : modo local o sin sesión
    idle --> syncing : sign in + cloudEnabled
    syncing --> saved : GET/PUT correctos
    syncing --> error : fallo de red/Firestore
    saved --> syncing : cambio local (debounce)
    error --> syncing : reintento / Sync now
    saved --> idle : sign out
    error --> idle : sign out
```

| Estado | Significado |
|---|---|
| `idle` | Sincronización desactivada. |
| `syncing` | Cargando snapshot o guardando cambios. |
| `saved` | Última escritura correcta. |
| `error` | Fallo; se muestra aviso y se conserva la copia local. |

## Allowlist

```mermaid
stateDiagram-v2
    [*] --> allowed : POST /api/admin/access
    allowed --> [*] : DELETE /api/admin/access/:email
```

No hay estados intermedios. `allowed: false` se interpreta como no permitido en
`FirestoreAccessStore.isAllowed`, aunque el flujo normal elimina el documento.

## Servicio Cloud Run

```mermaid
stateDiagram-v2
    [*] --> scaled_to_zero : sin tráfico
    scaled_to_zero --> starting : llega una petición
    starting --> serving : startup probe OK
    starting --> failed : probe falla
    serving --> serving : peticiones
    serving --> scaled_to_zero : idle timeout
    serving --> failed : crash / revisión inválida
    failed --> [*] : Cloud Run reintenta la revisión
```

Notas:

- El API usa facturación por solicitud; los análisis se ejecutan como Cloud Run Jobs.
- El estado de cada análisis y los fragmentos temporales de uploads viven en Firestore.
- API, analyzer y Job tienen límites de escalado por instancia/tarea; los Jobs no quedan activos
  después de completar el análisis.
