# 07 — Requerimientos

## Requerimientos funcionales

| ID | Descripción | Prioridad | Estado | CU |
|---|---|---|---|---|
| RF-001 | Analizar una canción de YouTube a partir de un enlace | Alta | Implementado | CU-001 |
| RF-002 | Analizar un archivo de audio local | Alta | Implementado | CU-002 |
| RF-003 | Buscar en YouTube por nombre y analizar un resultado | Alta | Implementado | CU-003 |
| RF-004 | Detectar tonalidad, pulsos, compases, acordes y regiones vocales | Alta | Implementado | CU-001, CU-002 |
| RF-005 | Permitir corregir acordes, editar letra, capo, transposición y notación | Alta | Implementado | CU-004 |
| RF-006 | Reproducir, transponer y practicar tramos A–B | Alta | Implementado | CU-005 |
| RF-007 | Guardar canciones, setlists, historial y preferencias en local | Alta | Implementado | CU-006, CU-007 |
| RF-008 | Exportar e importar JSON, ChordPro y MusicXML; imprimir PDF | Media | Implementado | CU-013 |
| RF-009 | Iniciar sesión con Google y restringir el acceso a una allowlist | Alta | Implementado | CU-008 |
| RF-010 | Gestionar la allowlist desde una página de administración | Alta | Implementado | CU-009 |
| RF-011 | Guardar canciones y setlists por usuario en Firestore | Alta | Implementado | CU-010 |
| RF-012 | Fusionar la biblioteca local y la nube por fuente y `updatedAt` | Alta | Implementado | CU-010 |
| RF-013 | Sincronizar automáticamente con debounce y permitir “Sync now” | Media | Implementado | CU-010 |
| RF-014 | Preparar y servir audio temporal de YouTube para el pitch | Media | Implementado | CU-011 |
| RF-015 | Obtener letras desde LRCLIB | Media | Implementado | CU-012 |
| RF-016 | Servir la SPA y la API desde el mismo origen | Alta | Implementado | CU-014 |
| RF-017 | Autenticar el servidor contra el analyzer en Cloud Run con IAM | Alta | Implementado | CU-014 |
| RF-018 | Provisionar la infraestructura con Terraform | Alta | Implementado | CU-014 |
| RF-019 | Escalar a cero cuando no hay tráfico | Alta | Implementado | CU-014 |
| RF-020 | Ofrecer un endpoint de salud que compruebe el analyzer | Media | Implementado | CU-014 |
| RF-021 | Eliminar la cuenta y todos los datos online del usuario | Media | Implementado | CU-015 |
| RF-022 | Gestionar cuotas por usuario en la instancia online | Baja | **Pendiente** | CU-010 |
| RF-023 | Persistir los jobs para sobrevivir a reinicios | Media | **Pendiente** | CU-001, CU-002 |
| RF-024 | Añadir roles de administración en Firestore | Baja | **Pendiente** | CU-009 |
| RF-025 | Exponer capacidades de nube/YouTube al cliente | Media | Implementado | CU-014 |

## Requerimientos no funcionales

| ID | Categoría | Descripción | Métrica / criterio | Estado |
|---|---|---|---|---|
| RNF-001 | Seguridad | El ID token de Google se verifica siempre en el servidor | `google-auth-library`, audiencia = client ID | Implementado |
| RNF-002 | Seguridad | Toda petición online pasa por la allowlist salvo auth/config y health | 401 sin token, 403 fuera de lista | Implementado |
| RNF-003 | Seguridad | El analyzer de Cloud Run no es público | `roles/run.invoker` solo para la SA del servidor | Implementado |
| RNF-004 | Seguridad | CSP estricta y mismo origen | `script-src 'self' accounts.google.com`; sin `unsafe-eval` | Implementado |
| RNF-005 | Coste | Caber en el free tier para uso personal | Cloud Run scale-to-zero, Firestore free tier, sin LB/IAP | Implementado |
| RNF-006 | Rendimiento | Aceptar audio de hasta 25 MB y 15 minutos | `MAX_UPLOAD_BYTES`, `MAX_DURATION_SECONDS` | Implementado |
| RNF-007 | Rendimiento | Limitar análisis por IP | 60/hora por defecto | Implementado |
| RNF-008 | Disponibilidad | El fallo del analyzer no debe tumbar `/api/health` | Health devuelve 200 con `analyzer: down` | Implementado |
| RNF-009 | Disponibilidad | Los jobs no se pierden en un reinicio | Persistencia externa | **Pendiente** |
| RNF-010 | Escalabilidad | Soportar más de una instancia del servidor | Estado compartido | **Pendiente** |
| RNF-011 | Mantenibilidad | Tipos de API compartidos entre web y servidor | `packages/contracts` | Implementado |
| RNF-012 | Mantenibilidad | `App.tsx` dividido por features/páginas | ≤ 300 líneas por archivo de página | **Parcial** |
| RNF-013 | Mantenibilidad | Tests de servidor, web, analyzer y E2E | 87 + 359 + 28 + analyzer | Implementado |
| RNF-014 | Privacidad | El modo local no envía datos a terceros salvo YouTube/LRCLIB | Sin cuentas ni analytics | Implementado |
| RNF-015 | Privacidad | Documentar el tratamiento de datos del modo online | `PRIVACY.md` actualizado | Implementado |
| RNF-016 | Observabilidad | Logs operativos y errores estructurados | Cloud Logging + envelope de error | Implementado |
| RNF-017 | Observabilidad | Métricas, trazas y alertas de error | Cloud Monitoring / Sentry | **Pendiente** |
| RNF-018 | Operación | Estado de Terraform duradero | Backend GCS | **Pendiente** |
| RNF-019 | Accesibilidad | Sin violaciones críticas en las vistas principales | Axe E2E | Implementado |
| RNF-020 | Compatibilidad | Node 22.22+/24.15+, Python 3.11+, navegadores modernos | CI + E2E Chromium | Implementado |

## Requerimientos de datos

| ID | Descripción | Estado |
|---|---|---|
| RD-001 | La biblioteca local debe sobrevivir a recargas y migrar claves legadas | Implementado |
| RD-002 | La copia local debe seguir siendo utilizable si falla la nube | Implementado |
| RD-003 | La nube debe guardar cada usuario bajo su `uid` | Implementado |
| RD-004 | La allowlist debe ser independiente de la biblioteca | Implementado |
| RD-005 | Debe existir una política de retención/borrado de Firestore | **Pendiente** |
| RD-006 | Debe existir un backup/export de Firestore | **Pendiente** |

## Supuestos

- El uso previsto es personal o un grupo pequeño (`[INFERRED]`).
- No hay SLA contractual.
- El administrador es también el operador de la instancia.
- La instancia online no se ofrece como SaaS público.
