# 09 — Diagramas de secuencia

## CU-001 — Analizar un video de YouTube

```mermaid
sequenceDiagram
    actor U as Usuario
    participant SPA
    participant API
    participant Q as JobQueue
    participant YT as yt-dlp
    participant A as Analyzer
    participant DB as JobStore

    U->>SPA: Pega enlace / pulsa analizar
    SPA->>API: POST /api/analyses { youtubeUrl }
    API->>DB: create(job)
    API->>Q: add(task)
    API-->>SPA: 202 { id, status: queued }
    Q->>YT: probe + download
    YT-->>Q: audio
    Q->>A: POST /analyze (WAV)
    A-->>Q: segmentos, beats, vocalRegions
    Q->>DB: update(job, done, result)
    loop Polling
        SPA->>API: GET /api/analyses/:id
        API-->>SPA: { status, progress }
    end
    SPA->>SPA: songFromResult + guardar
```

**Errores:** el job pasa a `error` si yt-dlp o el analyzer fallan; la SPA muestra el código
localizado y permite reintentar.

## CU-002 — Analizar un archivo

```mermaid
sequenceDiagram
    actor U as Usuario
    participant SPA
    participant API
    participant A as Analyzer

    U->>SPA: Selecciona archivo
    SPA->>API: POST /api/analyses (multipart)
    API->>API: valida extensión, firma y tamaño
    alt válido
        API-->>SPA: 202 { job }
        API->>A: POST /analyze (WAV)
        A-->>API: resultado
        SPA->>API: GET /api/analyses/:id (polling)
        API-->>SPA: done + result
    else inválido
        API-->>SPA: 422 INVALID_AUDIO
    end
```

## CU-008 — Login con Google y allowlist

```mermaid
sequenceDiagram
    actor U as Usuario
    participant SPA
    participant GIS as Google Identity
    participant API
    participant FS as Firestore

    SPA->>API: GET /api/auth/config
    API-->>SPA: { mode: google, clientId }
    SPA->>GIS: renderButton / initialize
    U->>GIS: Elige cuenta
    GIS-->>SPA: credential (ID token)
    SPA->>SPA: sessionStorage + setAuthToken
    SPA->>API: GET /api/auth/me (Bearer)
    API->>GIS: verifyIdToken(audience)
    GIS-->>API: payload
    API->>FS: isAllowed(email)
    FS-->>API: true/false
    alt permitido
        API-->>SPA: { user, allowed: true, admin }
        SPA->>SPA: render App
    else no permitido
        API-->>SPA: { user, allowed: false }
        SPA->>U: Access not enabled
    end
```

## CU-009 — Gestionar la allowlist

```mermaid
sequenceDiagram
    actor A as Administrador
    participant SPA
    participant API
    participant FS as Firestore

    A->>SPA: Abre #/admin
    SPA->>API: GET /api/admin/access
    API->>FS: orderBy(email)
    FS-->>API: entries
    API-->>SPA: { entries }
    A->>SPA: Añade email
    SPA->>API: POST /api/admin/access { email }
    API->>FS: set(chordifree_access/{email})
    API-->>SPA: 201 { entry }
    A->>SPA: Quita email
    SPA->>API: DELETE /api/admin/access/:email
    API->>FS: delete
    API-->>SPA: 204
```

## CU-010 — Sincronizar la biblioteca

```mermaid
sequenceDiagram
    participant SPA
    participant API
    participant FS as Firestore

    SPA->>API: GET /api/cloud/library (Bearer)
    API->>FS: songs.get + setlists.get
    FS-->>API: snapshot
    API-->>SPA: { songs, setlists }
    SPA->>SPA: merge por sourceKey/updatedAt
    SPA->>SPA: guardar local + refreshLibrary
    SPA->>API: PUT /api/cloud/library { songs, setlists }
    API->>FS: borrar faltantes + batch set
    API-->>SPA: { saved: true }
    Note over SPA,API: Cambios posteriores con debounce 1,2 s<br/>o botón Sync now
```

**Error:** si el `PUT` falla, la copia local se conserva y la UI muestra `cloud.error`.

## CU-014 — Despliegue

```mermaid
sequenceDiagram
    actor O as Operador
    participant TF as Terraform
    participant CB as Cloud Build
    participant AR as Artifact Registry
    participant CR as Cloud Run
    participant FS as Firestore

    O->>TF: ./deploy.sh
    TF->>AR: crea repositorio
    O->>CB: builds submit (server)
    CB->>AR: push imagen
    O->>CB: builds submit (analyzer)
    CB->>AR: push imagen
    TF->>FS: crea base de datos
    TF->>CR: crea analyzer privado
    TF->>CR: crea server con env vars
    TF-->>O: service_url
    O->>O: añade URL a orígenes OAuth
```

## CU-015 — Borrar datos online y cuenta

```mermaid
sequenceDiagram
    actor U as Usuario
    participant SPA
    participant API
    participant FS as Firestore

    U->>SPA: Delete cloud data
    SPA->>U: Confirmar (la copia local permanece)
    U->>SPA: Confirmar
    SPA->>API: DELETE /api/account (Bearer)
    API->>FS: borrar songs + setlists de chordifree_users/{uid}
    alt no es administrador
        API->>FS: borrar chordifree_access/{email}
    else administrador
        API->>API: conservar acceso por ADMIN_EMAILS
    end
    API-->>SPA: { deleted, songs, setlists, accessRemoved }
    alt accessRemoved
        SPA->>SPA: signOut + pantalla de login
    else administrador
        SPA->>U: aviso y biblioteca local intacta
    end
```
