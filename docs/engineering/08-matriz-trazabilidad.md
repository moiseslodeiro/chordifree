# 08 — Matriz de trazabilidad

Cada fila cruza un requerimiento con los casos de uso que lo cubren. `x` = cubierto;
`P` = parcial; vacío = no cubierto.

| Requerimiento | CU-001 | CU-002 | CU-003 | CU-004 | CU-005 | CU-006 | CU-007 | CU-008 | CU-009 | CU-010 | CU-011 | CU-012 | CU-013 | CU-014 | CU-015 | Cobertura |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RF-001 | x | | | | | | | | | | | | | | | Completa |
| RF-002 | | x | | | | | | | | | | | | | | Completa |
| RF-003 | | | x | | | | | | | | | | | | | Completa |
| RF-004 | x | x | | | | | | | | | | | | | | Completa |
| RF-005 | | | | x | | | | | | | | | | | | Completa |
| RF-006 | | | | | x | | | | | | | | | | | Completa |
| RF-007 | | | | | | x | x | | | | | | | | | Completa |
| RF-008 | | | | | | | | | | | | | x | | | Completa |
| RF-009 | | | | | | | | x | | | | | | | | Completa |
| RF-010 | | | | | | | | | x | | | | | | | Completa |
| RF-011 | | | | | | | | | | x | | | | | | Completa |
| RF-012 | | | | | | | | | | x | | | | | | Completa |
| RF-013 | | | | | | | | | | x | | | | | | Completa |
| RF-014 | | | | | | | | | | | x | | | | | Completa |
| RF-015 | | | | | | | | | | | | x | | | | Completa |
| RF-016 | | | | | | | | | | | | | | x | | Completa |
| RF-017 | | | | | | | | | | | | | | x | | Completa |
| RF-018 | | | | | | | | | | | | | | x | | Completa |
| RF-019 | | | | | | | | | | | | | | x | | Completa |
| RF-020 | | | | | | | | | | | | | | x | | Completa |
| RF-021 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RF-022 | | | | | | | | | | P | | | | | | Parcial |
| RF-023 | P | P | | | | | | | | | | | | | | Parcial |
| RF-024 | | | | | | | | | P | | | | | | | Parcial |
| RNF-001 | | | | | | | | x | x | x | | | | x | | Completa |
| RNF-002 | x | x | x | x | x | x | x | x | x | x | x | x | x | | | Completa |
| RNF-003 | | | | | | | | | | | | | | x | | Completa |
| RNF-004 | x | x | x | x | x | x | x | x | x | x | x | x | x | x | | Completa |
| RNF-005 | | | | | | | | | | | | | | x | | Completa |
| RNF-006 | P | P | | | | | | | | | | | | | | Parcial |
| RNF-007 | P | P | P | | | | | | | | | P | | | | Parcial |
| RNF-008 | | | | | | | | | | | | | | x | | Completa |
| RNF-009 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-010 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-011 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-012 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-013 | x | x | x | x | x | x | x | x | x | x | x | x | x | x | | Completa |
| RNF-014 | x | x | x | x | x | x | x | x | x | | | x | x | | | Completa |
| RNF-015 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-016 | x | x | x | x | x | x | x | x | x | x | x | x | x | x | | Completa |
| RNF-017 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-018 | | | | | | | | | | | | | | | | **Sin cubrir** |
| RNF-019 | | | | | | x | | | | | | | | | | Parcial |
| RNF-020 | x | x | x | x | x | x | x | x | x | x | x | x | x | x | | Completa |

## Cobertura por caso de uso

| CU | Requerimientos cubiertos |
|---|---|
| CU-001 | RF-001, RF-004, RF-023, RNF-002, RNF-004, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-002 | RF-002, RF-004, RF-023, RNF-002, RNF-004, RNF-006, RNF-007, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-003 | RF-003, RNF-002, RNF-004, RNF-007, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-004 | RF-005, RNF-002, RNF-004, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-005 | RF-006, RNF-002, RNF-004, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-006 | RF-007, RNF-002, RNF-004, RNF-013, RNF-014, RNF-016, RNF-019, RNF-020 |
| CU-007 | RF-007, RNF-002, RNF-004, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-008 | RF-009, RNF-001, RNF-002, RNF-004, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-009 | RF-010, RF-024, RNF-001, RNF-002, RNF-004, RNF-013, RNF-016, RNF-020 |
| CU-010 | RF-011, RF-012, RF-013, RF-022, RNF-001, RNF-002, RNF-004, RNF-013, RNF-016, RNF-020 |
| CU-011 | RF-014, RNF-002, RNF-004, RNF-007, RNF-013, RNF-016, RNF-020 |
| CU-012 | RF-015, RNF-002, RNF-004, RNF-007, RNF-013, RNF-014, RNF-016, RNF-020 |
| CU-013 | RF-008, RNF-002, RNF-004, RNF-014, RNF-016, RNF-020 |
| CU-014 | RF-016, RF-017, RF-018, RF-019, RF-020, RNF-003, RNF-004, RNF-005, RNF-008, RNF-013, RNF-016, RNF-020 |
| CU-015 | Ninguno: caso de uso pendiente |

## Huecos principales

1. **RF-021 / CU-015:** no hay borrado de cuenta ni de biblioteca online.
2. **RNF-009 / RNF-010:** la persistencia de jobs y el escalado horizontal no existen.
3. **RNF-011 / RNF-012:** contratos compartidos y división de `App.tsx`.
4. **RNF-015:** `PRIVACY.md` no describe todavía el modo online.
5. **RNF-017 / RNF-018:** faltan métricas/trazas y backend remoto de Terraform.
