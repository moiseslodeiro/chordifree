# 13 — Decisiones técnicas (ADR)

Las fechas son las de la documentación (`2026-11-16`) salvo que el código indique otra cosa.

---

## ADR-001 — Monolito modular con analizador separado

- **Estado:** Aceptada
- **Contexto:** La app necesita UI, API, análisis de audio y dominio musical. El análisis usa
  Python/Essentia; el resto TypeScript.
- **Decisión:** Mantener un monorepo con SPA, API Express y un único servicio FastAPI para el
  analyzer. El dominio musical vive en `packages/chords`.
- **Alternativas:** Microservicios por dominio; monolito único en Python; monolito único en
  Node.
- **Consecuencias:** Menos coste operativo y despliegues simples. El analyzer es el único
  servicio con ciclo de vida distinto. La API sigue siendo un punto único para el estado
  efímero.

## ADR-002 — Google ID token verificado en servidor, sin IAP

- **Estado:** Aceptada
- **Contexto:** Se quiere restringir el acceso a cuentas aprobadas con coste mínimo.
- **Decisión:** Google Identity Services en el navegador + `google-auth-library` en el
  servidor; allowlist en Firestore; administradores desde `ADMIN_EMAILS`.
- **Alternativas:** IAP + load balancer; OAuth con sesión de servidor; Auth0/Clerk.
- **Consecuencias:** Sin coste de LB/IAP y control total del login. Hay que gestionar la
  allowlist, los orígenes OAuth y la rotación de administradores (requiere redeploy).

## ADR-003 — Firestore nativo para allowlist y biblioteca

- **Estado:** Aceptada
- **Contexto:** El modo online necesita persistencia por usuario con free tier.
- **Decisión:** Firestore Native con `chordifree_access/{email}` y
  `chordifree_users/{uid}/songs|setlists`.
- **Alternativas:** Cloud SQL; BigQuery; Supabase; solo `localStorage`.
- **Consecuencias:** Free tier generoso y cero administración. Firestore es schemaless, así
  que la validación recae en Zod. El snapshot completo simplifica la API pero limita el merge
  fino.

## ADR-004 — Cloud Run scale-to-zero y análisis bajo demanda

- **Estado:** Aceptada
- **Contexto:** El coste debe ser mínimo y los análisis no deben mantener CPU asignada en el API
  tras responder a la petición.
- **Decisión:** El API y el analyzer usan Cloud Run con `min_instance_count=0`; el API usa
  facturación por solicitud. Cada análisis se ejecuta como Cloud Run Job y su estado/upload
  temporal se guarda en Firestore. Se limita cada ejecución a una tarea y el API a una instancia.
- **Alternativas:** VM siempre encendida; Kubernetes; Cloud Functions; mantener la cola en el
  proceso del API.
- **Consecuencias:** El API escala a cero y los Jobs solo consumen recursos al analizar. Un fallo
  del worker ya no pierde el estado del job, aunque cada análisis sigue consumiendo cuota y puede
  generar cargos.

## ADR-005 — Biblioteca online como snapshot completo

- **Estado:** Aceptada
- **Contexto:** La biblioteca es pequeña y el merge local/nube ya existe en la SPA.
- **Decisión:** `GET/PUT /api/cloud/library` con canciones y setlists completos; el servidor
  reemplaza el snapshot por usuario.
- **Alternativas:** CRUD por canción/setlist; delta sync; CRDT.
- **Consecuencias:** API simple y fácil de testear. Last-write-wins y más tráfico si la
  biblioteca crece. Se puede migrar a escrituras por documento sin cambiar el modelo.

## ADR-006 — Dos modos de ejecución (`AUTH_MODE`)

- **Estado:** Aceptada
- **Contexto:** El producto local/escritorio no debe exigir cuentas, pero el online sí.
- **Decisión:** `AUTH_MODE=none` (por defecto) y `AUTH_MODE=google`. El modo se sirve en
  runtime desde `/api/auth/config`; no se compila en el frontend.
- **Alternativas:** Dos builds separados; feature flag en build; fork del producto.
- **Consecuencias:** Un solo binario/imagen para ambos modos. El frontend siempre hace una
  petición de configuración al arrancar. El modo local conserva la biblioteca en el navegador.

## ADR-007 — Terraform + Artifact Registry + analyzer privado

- **Estado:** Aceptada
- **Contexto:** La infraestructura debía ser reproducible y barata.
- **Decisión:** Terraform crea APIs, Artifact Registry, Firestore, service accounts, IAM y
  Cloud Run. El analyzer es privado y solo lo invoca la SA del servidor con ID token.
- **Alternativas:** `gcloud run deploy --source`; Pulumi; Cloud Deployment Manager; Docker
  Compose en una VM.
- **Consecuencias:** Reproducible y auditable. El estado local es un riesgo; se recomienda
  backend GCS. La imagen del analyzer es grande y Artifact Registry puede costar céntimos.

## ADR-008 — Misma origin para SPA y API

- **Estado:** Aceptada
- **Contexto:** Simplificar CORS, CSP y despliegue; evitar un hosting adicional.
- **Decisión:** Express sirve el build de la SPA y expone `/api`. En Docker, nginx hace de
  frontend y proxy.
- **Alternativas:** CDN estática + API separada; subdominios distintos; Next.js.
- **Consecuencias:** Un solo origen y CSRF más simple (`sameOriginWriteGuard`). El frontend y
  el backend se despliegan juntos; un cambio de UI requiere reconstruir la imagen del servidor.

## ADR-009 — `localStorage` como fuente local y espejo en nube

- **Estado:** Aceptada
- **Contexto:** El usuario debe poder trabajar sin cuenta y sin conexión.
- **Decisión:** La biblioteca local es la copia operativa; la nube es un espejo opcional. La
  fusión se hace en la SPA por `sourceKey` y `updatedAt`.
- **Alternativas:** Nube como fuente de verdad; IndexedDB; SQLite local.
- **Consecuencias:** La app sigue funcionando si falla Firestore. Los conflictos se resuelven
  por last-write-wins. `localStorage` tiene cuota y se maneja con avisos/purga.

## ADR-010 — Validación Zod y envelope de error uniforme

- **Estado:** Aceptada
- **Contexto:** La API recibe JSON, formularios y parámetros de terceros.
- **Decisión:** Zod en cada frontera; `ApiError` con `code` + `status`; respuesta
  `{ error: { code, message } }`.
- **Alternativas:** Validación manual; JSON Schema; tRPC.
- **Consecuencias:** Contratos explícitos y mensajes localizables. Los tipos web/servidor aún
  están duplicados; se propone `packages/contracts`.

## ADR-011 — Cola de jobs en memoria

- **Estado:** Aceptada (con deuda)
- **Contexto:** El análisis es asíncrono y el volumen esperado es bajo.
- **Decisión:** `JobStore` + `JobQueue` en memoria, con concurrencia 2 y TTL 24 h.
- **Alternativas:** Cloud Tasks + Firestore; BullMQ + Redis; cola en SQLite.
- **Consecuencias:** Cero infraestructura extra y código simple. Los jobs se pierden al
  reiniciar y no se puede escalar a más de una instancia. Es la primera cosa a cambiar si el
  online crece.

## ADR-012 — Sin load balancer ni IAP

- **Estado:** Aceptada
- **Contexto:** Prioridad absoluta al coste y a una instancia privada pequeña.
- **Decisión:** Exponer Cloud Run directamente y aplicar la allowlist en Express.
- **Alternativas:** HTTPS LB + IAP; API Gateway; Cloud Armor.
- **Consecuencias:** Coste cero de red gestionada. La seguridad de acceso depende del código
  de auth; el analyzer sigue privado con IAM. No hay WAF ni protección DDoS dedicada.

## ADR-013 — Empaquetado de escritorio con Electron

- **Estado:** Aceptada (experimental)
- **Contexto:** Se quiere una app instalable que incluya el analyzer y los modelos.
- **Decisión:** Electron + electron-builder; builds de Windows, macOS arm64 y Linux x64.
- **Alternativas:** Tauri; PWA; contenedor Docker de escritorio.
- **Consecuencias:** Reutiliza la SPA y el servidor; el paquete es grande. macOS no está
  notarizado y Windows no está firmado, con avisos de SmartScreen/Gatekeeper.

---

## ADR-014 — Extractor de YouTube en una IP residencial (opcional)

- **Estado:** Aceptada
- **Contexto:** YouTube bloquea las IPs de datacenter/Cloud Run con “Sign in to confirm you're
  not a bot”. Los cookies y los PO tokens no son fiables en esas IPs; un proxy residencial
  resuelve el problema pero cuesta dinero.
- **Decisión:** Ofrecer un extractor HTTP opcional (`services/youtube-extractor`) que corre
  `yt-dlp` en una máquina con IP residencial (por ejemplo una Raspberry Pi) detrás de un túnel.
  El servidor de Cloud Run lo usa para probe/search/download cuando `YOUTUBE_EXTRACTOR_URL`
  está configurado; el analyzer y la biblioteca siguen en Cloud Run.
- **Alternativas:** cookies de una cuenta; proxy residencial de pago; servicios públicos
  Invidious/Piped/Cobalt; mover todo el stack a casa; subida manual de audio.
- **Consecuencias:** Es gratis (salvo la electricidad) y usa la IP que YouTube espera. Requiere
  un equipo encendido y un token compartido; si el extractor está apagado, YouTube falla pero
  la subida de audio sigue funcionando. No cambia el comportamiento cuando la variable está
  vacía.

---

## ADR-015 — Borrado de datos online desde el menú de cuenta

- **Estado:** Aceptada
- **Contexto:** El modo online guarda canciones y setlists en Firestore. Quitar una cuenta
  de la allowlist no borra sus datos, y no había una forma de que el usuario los eliminara.
- **Decisión:** Añadir `DELETE /api/account`. Borra el snapshot del usuario y, si no es
  administrador, elimina también su entrada de la allowlist. Los administradores conservan
  el acceso porque están en `ADMIN_EMAILS`. La copia local no se borra.
- **Alternativas:** borrar solo la allowlist; borrar solo la biblioteca; borrar también el
  almacenamiento local; exigir una intervención manual del operador.
- **Consecuencias:** El usuario puede ejercer un borrado básico sin acceso al proyecto de
  GCP. El operador sigue siendo responsable de backups, retención y borrado de logs. La
  acción es destructiva y requiere confirmación en la UI.

---

## ADR-016 — Contratos compartidos en `packages/contracts`

- **Estado:** Aceptada
- **Contexto:** Web y servidor duplicaban `AnalysisResult`, `Song`, `Setlist`, `AuthUser`,
  `LyricsResult` y el esquema del snapshot de nube.
- **Decisión:** Crear `packages/contracts` con tipos compartidos y los esquemas Zod que
  cruzan la API. Web y servidor lo consumen como workspace package.
- **Alternativas:** Generar tipos desde OpenAPI; mantener duplicados con tests de contrato;
  usar tRPC.
- **Consecuencias:** Una sola fuente para los contratos y el esquema de nube. El paquete
  añade Zod al servidor y tipos al frontend; el cliente importa tipos, no necesariamente el
  runtime de Zod.

## ADR-017 — Capacidades públicas y límites por usuario

- **Estado:** Aceptada
- **Contexto:** La SPA no sabía si el modo online tenía nube o extractor, y los límites de
  análisis eran por IP (todos los usuarios de una red compartían cuota).
- **Decisión:** Añadir `GET /api/config` con `features.cloudLibrary` y `features.youtube`, y
  usar `req.authUser.uid` como clave de los rate limits.
- **Alternativas:** Deducir capacidades de los errores; un flag compilado en el frontend;
  límites por IP.
- **Consecuencias:** La UI puede avisar de YouTube bloqueado y priorizar la subida. Los
  límites son por cuenta en modo Google y por usuario local en modo local. No hay cuotas
  persistentes más allá del rate limit en memoria de una instancia.

---

## ADR-018 — Alertas en Cloud Monitoring y trazas OTLP

- **Estado:** Aceptada
- **Contexto:** Solo había logs y una alerta de presupuesto; no había avisos de fallos de
  análisis, 5xx, caída del health check ni trazas distribuidas.
- **Decisión:** Terraform crea un canal de email, una métrica basada en logs para fallos de
  análisis, una alerta de 5xx, un uptime check de `/api/health` y sus alertas. El servidor
  exporta trazas OTLP a `telemetry.googleapis.com` cuando `OTEL_ENABLED=true`, con
  `roles/telemetry.writer`. El exportador de Google Cloud Trace específico se descartó por
  estar deprecado.
- **Alternativas:** `@google-cloud/opentelemetry-cloud-trace-exporter` (deprecado), Sentry,
  Prometheus/GMP, no instrumentar.
- **Consecuencias:** Trazas y alertas dentro de GCP, sin agente adicional. El canal de email
  requiere verificación. El SDK de OpenTelemetry solo se carga si `OTEL_ENABLED=true`; en
  local/escritorio queda desactivado. El volumen de trazas y la retención dependen del
  proyecto y del free tier.
