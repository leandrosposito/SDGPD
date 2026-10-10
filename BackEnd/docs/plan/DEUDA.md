# Deuda viva del backend

**Verificado:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`, los reportes BE-0a..BE-1c y el filesystem. No se copian afirmaciones históricas sin volver a comprobarlas.

## Estado de lo construido

| Ítem | Estado actual | Evidencia |
|---|---|---|
| D1 — FK generadas con prefijo `public`. | `[REVERIFICADO]` riesgo de migración: revisar cada SQL generado antes de aplicar; no se corrige desde documentación. | `FrontEnd/docs/ESTADO.md:137-148`, `BackEnd/docs/CLAUDE.md:18-20` |
| Express expone `X-Powered-By`. | `[REVERIFICADO]` deuda técnica de hardening. | `FrontEnd/docs/ESTADO.md:148` |
| Validación IANA de `companies.timezone`. | `[REVERIFICADO]` queda para IAM/organización posterior. | `FrontEnd/docs/ESTADO.md:148` |
| Auditoría de mutaciones. | `[REVERIFICADO]` la API tipada y lint cubren el camino esperado; SQL crudo/reflexión fuera del alcance del lint requieren revisión adversarial en cada tanda. | `FrontEnd/docs/ESTADO.md:131-135`, ADR-BE-005 |
| Checklist funcional BE-0a. | `[NO EJECUTADO]` debe correrlo Leandro con Postgres y curl. | `BackEnd/docs/verificaciones/VERIFICACION_BE-0a.md` |
| Checklist funcional BE-1a. | `[NO EJECUTADO]` el archivo existe y fue actualizado para `/api`; no hay evidencia de ejecución. | `BackEnd/docs/verificaciones/VERIFICACION_BE-1a.md`, `FrontEnd/docs/ESTADO.md:61-64` |
| Checklist BE-0b. | `[NO EJECUTADO]` se dejó documentado como pendiente. | `FrontEnd/docs/ESTADO.md:131-135` |
| Checklist BE-1b. | `[NO EJECUTADO]` incluye modo HTTP, refresh y UI. | `FrontEnd/docs/ESTADO.md:24-49` |
| Checklist BE-1c. | `[NO EJECUTADO]` incluye refresh entre pestañas y zod deduplicado. | `FrontEnd/docs/ESTADO.md:11-22` |
| Chunk inicial de frontend tras auth/contracts. | `[REVERIFICADO]` sigue abierto (~169 kB según el snapshot); no pertenece al backend de negocio. | `FrontEnd/docs/ESTADO.md:21` |
| BE-2. | `[EN CURSO EN RAMA]` contratos/tablas/RLS/endpoints/seed de maestros en `origin/sesion-be2-2026-10-10:b1aedf5`; faltan tests endpoint/contratos, gates y frontend. | `BackEnd/docs/plan/BE-02-maestros.md` |

## Deuda de los reportes, no duplicada

- BE-0a reportó la revisión manual de SQL generado y el hardening de Express como deuda; se mantienen arriba porque siguen presentes en el estado de entrada.
- BE-0b reportó que la garantía de auditoría depende de API/lint y que SQL crudo queda para revisión; se mantiene como riesgo de revisión, no como bug demostrado.
- BE-1a reportó la FK de `user_id` como parte del cierre y la validación de último admin; no se vuelve a listar como deuda.
- BE-1b cerró HMAC de idempotencia, último admin, limpieza de refresh, prefijo `/api` y workspaces; no se reportan como pendientes. El checklist sí queda pendiente.
- BE-1c cerró refresh coordinado entre pestañas y una sola versión de zod; no se reportan como pendientes. El checklist sí queda pendiente.

## Checklists BE sin ejecutar

1. `BackEnd/docs/verificaciones/VERIFICACION_BE-0a.md`.
2. `BackEnd/docs/verificaciones/VERIFICACION_BE-1a.md`.
3. `FrontEnd/docs/historial/verificaciones/VERIFICACION_BE-0b.md`.
4. `FrontEnd/docs/historial/verificaciones/VERIFICACION_BE-1b.md`.
5. `FrontEnd/docs/historial/verificaciones/VERIFICACION_BE-1c.md`.
6. `BackEnd/docs/verificaciones/VERIFICACION_BE-2.md` — `[PROPUESTO]` debe crearse al cerrar BE-2; la rama actual no lo tiene.

La ausencia de ejecución no se corrige cambiando checks. La siguiente sesión debe pegar la salida real y distinguir fallos de conexión a Postgres de fallos de aplicación.
