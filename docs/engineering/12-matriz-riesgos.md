# 12 — Matriz de riesgos

Escala: probabilidad e impacto `Baja / Media / Alta`; nivel = combinación cualitativa.

| ID | Riesgo | Prob. | Impacto | Nivel | Mitigación | Componente | Estado |
|---|---|---|---|---|---|---|---|
| RT-001 | Un deploy o reinicio pierde jobs y audio temporal en curso | Alta | Medio | Alto | Persistir jobs en Firestore + Cloud Tasks; audio en GCS | Server / Cloud Run | Aceptado |
| RT-002 | El límite de 1 instancia satura el servidor con varios usuarios | Media | Alto | Alto | Cola externa + estado compartido; cuotas por usuario | Server | Aceptado |
| RT-003 | El snapshot completo pisa cambios de otro dispositivo | Media | Medio | Medio | Revisión/ETag o escrituras por canción/setlist | Cloud library | Pendiente |
| RT-004 | yt-dlp deja de funcionar por cambios de YouTube | Alta | Medio | Alto | Actualizar yt-dlp con pin; tests de humo; fallback a subida | Media / analysis | Mitigado parcial |
| RT-005 | El cliente OAuth o el origen autorizado están mal configurados | Media | Medio | Medio | Guía de despliegue, checklist y mensajes de error claros | Auth / OAuth | Mitigado |
| RT-006 | Cold start del analyzer supera el timeout percibido | Media | Medio | Medio | Startup probe, 4 GiB, reintento de la SPA | Analyzer / Cloud Run | Mitigado parcial |
| RT-007 | Cuota o coste de Firestore/Cloud Run supera el free tier | Baja | Medio | Medio | Budget alert, límites, keep-3 de imágenes | GCP | Mitigado |
| RT-008 | El token de Google en `sessionStorage` se filtra por XSS | Baja | Alto | Medio | CSP estricta, dependencias auditadas, expiración del token | Web auth | Aceptado |
| RT-009 | Pérdida del estado local de Terraform | Media | Alto | Alto | Backend GCS + backup del state | Terraform | Pendiente |
| RT-010 | `PRIVACY.md` no cubre el modo online | Alta | Medio | Alto | Actualizar política: email, uid, biblioteca, retención y borrado | Documentación/legal | Mitigado |
| RT-011 | `App.tsx` concentra demasiada lógica y favorece regresiones | Alta | Medio | Alto | Hooks/páginas extraídos; `SongView` dividido; faltan `App.tsx` ≤300 y tests de merge/sync | Web | Mitigado parcial |
| RT-012 | Tipos web/servidor divergen | Media | Medio | Medio | `packages/contracts` con Zod | Web + server | Mitigado |
| RT-013 | Dependencia con vulnerabilidad conocida | Media | Alto | Alto | `pnpm audit`, Dependabot, pin de versiones | Repo | Pendiente |
| RT-014 | Firestore sin backup ni política de retención | Media | Alto | Alto | TTL operativo; falta export programado + runbook de borrado | Firestore | Mitigado parcial |
| RT-015 | El administrador no puede revocar acceso rápidamente | Baja | Medio | Bajo | Eliminar de `#/admin`; el token dura ~1 h | Auth | Mitigado parcial |
| RT-016 | Análisis de audio de usuarios consume CPU/memoria y afecta a otros | Media | Medio | Medio | `max_instance_count=1`, rate limit, cuotas por usuario | Server / analyzer | Aceptado |
| RT-017 | El fallo del analyzer deja la app “viva” pero inutilizable | Media | Medio | Medio | `/api/health` muestra `analyzer: down`; reintentos | Server | Mitigado |
| RT-018 | Errores de IAM al invocar el analyzer privado | Media | Medio | Medio | Terraform crea el binding; guía de troubleshooting | Cloud Run / IAM | Mitigado |

## Riesgos prioritarios para el refactor

1. **RT-011 (App.tsx):** es el mayor coste de mantenimiento y el que más fricción añade a
   cualquier feature nueva.
2. **RT-012 (contratos):** bajo coste de arreglo y alto retorno; reduce bugs de integración.
3. **RT-001/RT-002 (jobs):** no bloquean el uso personal, pero definen el techo del online.
4. **RT-014 (backups/retención):** bloqueante antes de invitar a más gente. RT-010 (privacidad) ya está mitigado.
5. **RT-009 (state):** riesgo operativo silencioso; se resuelve con un backend GCS.
