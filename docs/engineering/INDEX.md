# Documentación de ingeniería — Chordifree

Documentación retrospectiva generada desde el código el **2026-11-16**. Describe el estado
actual, no una propuesta de producto.

## Índice

| # | Documento | Contenido |
|---|---|---|
| 01 | [Arquitectura del sistema](01-arquitectura-sistema.md) | C4 contexto/containers, topologías local y GCP, flujos |
| 02 | [Casos de uso](02-casos-de-uso.md) | 15 casos con flujos, alternativas y excepciones |
| 03 | [Modelo de dominio](03-modelo-dominio.md) | Entidades, relaciones y reglas de negocio |
| 04 | [Diagrama ER](04-diagrama-er.md) | Firestore, `localStorage`, estado en memoria |
| 05 | [Catálogo de API](05-catalogo-api.md) | Endpoints, auth, cuerpos, respuestas y errores |
| 06 | [Diagramas de estado](06-diagramas-estado.md) | Job, sesión, sync, allowlist y Cloud Run |
| 07 | [Requerimientos](07-requerimientos.md) | RF, RNF y requerimientos de datos |
| 08 | [Matriz de trazabilidad](08-matriz-trazabilidad.md) | RF/RNF contra casos de uso y huecos |
| 09 | [Diagramas de secuencia](09-diagramas-secuencia.md) | Análisis, login, allowlist, sync y despliegue |
| 10 | [Diagramas de actividad](10-diagramas-actividad.md) | Análisis, acceso y sincronización |
| 11 | [Mapa de errores](11-mapa-errores.md) | Códigos HTTP, origen, recuperación y severidad |
| 12 | [Matriz de riesgos](12-matriz-riesgos.md) | Riesgos técnicos y mitigaciones |
| 13 | [Decisiones técnicas](13-decisiones-tecnicas.md) | 13 ADRs con contexto y consecuencias |
| 14 | [Plan de refactor](14-plan-refactor.md) | Contratos y sync hechos; `App.tsx` parcial y `SongView` dividido |

## Resumen ejecutivo

Chordifree es un **monolito modular** con una SPA React, una API Express y un analizador
FastAPI separado. El dominio musical está aislado en `packages/chords`. El modo local no tiene
cuentas; el modo online añade Google Sign-In, allowlist en Firestore y biblioteca por usuario.
La infraestructura se despliega con Terraform en Cloud Run + Firestore, con scale-to-zero.

Fortalezas:

- Fronteras claras entre web, API, analyzer y dominio musical.
- Auth y cloud library con implementaciones en memoria/Firestore y tests.
- Seguridad coherente: token en servidor, allowlist, analyzer privado, CSP y mismo origen.
- Coste bajo y despliegue reproducible.

Deuda principal:

1. `App.tsx` sigue concentrando lógica (≈660 líneas; ya se extrajeron routing, preferencias, health, updates, audio cache, header y footer).
2. Jobs y audio temporal en memoria → 1 instancia y pérdida al reiniciar.
3. Estado de Terraform local y falta de backup programado de Firestore.
4. Persistencia de jobs, roles en Firestore y observabilidad avanzada.

## Huecos de documentación

Marcados `[PENDING]` en los documentos:

- Escalado horizontal (RNF-010).
- División completa de `App.tsx` en páginas (RNF-012, parcial).
- Trazas OTLP y alertas base ya existen; falta dashboards/SLOs y alertas de coste (RNF-017 parcial).
- Roles de administración en Firestore (RF-024).
- Backend remoto de Terraform (RNF-018).
- Backup de Firestore y runbook de borrado (RD-005 parcial / RD-006).

## Supuestos `[INFERRED]`

- El uso previsto es personal o un grupo pequeño.
- No hay SLA contractual ni obligación de multi-tenant.
- El administrador es también el operador de la instancia.
- La instancia online no se ofrece como SaaS público.

## Cómo se generó

- Análisis del código de `apps/web`, `apps/server`, `services/analyzer`, `packages/chords`,
  `deploy/gcp`, `docker-compose.yml` y los workflows de CI.
- Ejecución de tests y E2E para validar el comportamiento documentado.
- Plantillas del skill `software-architect` (C4, casos de uso, ER, API, requisitos, ADRs).
- Diagramas en Mermaid.

## Siguiente paso

El plan de refactor está en [14-plan-refactor.md](14-plan-refactor.md). El orden recomendado es:

1. `packages/contracts`.
2. Extraer `useCloudLibrary`.
3. Dividir `App.tsx` por páginas.

Después: `PRIVACY.md`, persistencia de jobs y backup/borrado de Firestore.
