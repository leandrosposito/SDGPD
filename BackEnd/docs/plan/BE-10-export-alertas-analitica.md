# BE-10 — Exportación, alertas, tablero y analítica

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada parcialmente por D-09; contratos de negocio dependen de BE-03..09.

## 1. Encabezado

No hay jobs backend ni analytics controller en `lean`; existen stores/browser jobs en los paths citados abajo.

## 2. Objetivo

Mover exportaciones y generación de archivos al servidor, generar/leída alertas por usuario, y exponer una única fuente SQL para dashboard y analítica con agregados y permisos.

## 3. Depende de

Consume listados y entidades de BE-03..09; usa BE-1 users/permissions; storage productivo depende D-09/BE-07. No duplica una fuente dashboard; `fetchDashboardData` se retira cuando los endpoints nuevos existen.

## 4. ADRs

ADR-BE-011: POST export job/GET status/download signed, columns by names whitelist, local disk dev/S3 prod, alert jobs/read per user, single SQL dashboard/analytics source and four widgets. ADR-BE-004: filters/order/page and errors. ADR-BE-005: job idempotency/audit. ADR-BE-001: jobs/migrations/gates. Objeciones resolved: four dashboard endpoints replace dead fetch functions; files not Postgres.

## 5. Modelo de datos

`export_jobs(empresa_id,id,resource,filters_json,sort_json,column_codes,format,status,progress,storage_key,error,created_by,expires_at)` with unique idempotency scope; `alerts(empresa_id,id,type,severity,created_at,payload)` append-only; `alert_reads(alert_id,user_id,read_at)` unique per user. Optional job lease/attempt columns for multi-instance requires D-09. Dashboard/analytics are SQL projections/views, not duplicated snapshots. RLS company and user-read policy. Index jobs/status, alerts/date/severity/user read.

## 6. Endpoints y contratos

Permissions reports/analytics/notifications × `ver|crear`; exports `ver|crear`.

| Método/path | Contract | Replaces |
|---|---|---|
| POST `/api/exports` | resource, filters/order, column names, format → 202 jobId | 15 GET exports |
| GET `/api/exports/:jobId` | status/progress/error | browser `getExportJobStatus` |
| GET `/api/exports/:jobId/download` | signed URL/expiry | `buildExportFile` |
| GET `/api/alerts/summary`, `/api/alerts` | cursor, type/severity, per-user read | #69–70 |
| POST `/api/alerts/:id/read` | user read idempotent | #71 |
| GET `/api/dashboard/aggregates`, `/kpis`, `/sales-series`, `/top-products`, `/recent-orders` | scoped aggregates | #14, #58–62 |
| GET `/api/analytics/:period` | metrics/top products/debtors/cash | direct mock |

All filters/order are resource whitelists and same as list; max export 10,000. No empresaId/actor. Errors `invalid-export-columns`, `invalid-query`, `job-not-found`, `job-expired`, `export-failed`. Job POST Idempotency-Key; alert generation has deterministic event key.

## 7. Reglas de negocio

B3/A15/A20 and M1–M6/M20 close by server job/list whitelist/cursor/read-per-user. Alert generation is idempotent per source event, does not duplicate, and read is user-scoped. Dashboard uses ADR-009 branch/company semantics per widget. Aggregates never computed over full client collection; analytics SQL supplies totals/rankings. Export uses exactly list filters/order, columns by code not client functions, signed URL expiry and retention. Job lease/parallel workers remain D-09.

## 8. Seed y datos

No seed fake jobs/files; deterministic alert fixtures reference real Delivery/Product UUIDs and user reads. Correct orphan names when source entity is real; analytics mock data is not authoritative. Dashboard fixtures only for tests, not runtime.

## 9. Arrastre frontend

`FrontEnd/src/shared/api/exports/{exportJobs,buildExportFile,exportTypes}.ts`, `useExportJob.ts`, alert service/layout, `FrontEnd/src/services/mock/dashboard.service.ts`, `FrontEnd/src/modules/dashboard/api/dashboardAggregates.service.ts`, `FrontEnd/src/modules/analytics/AnalyticsPage.tsx`, `data/mock/analytics.data.ts`.

Remove browser XLSX/job/map, use server poll/download and columns by code; add exports/analytics flags; URL filters/order; AlertsBell uses per-user read; delete legacy dashboard service only after four widget endpoints; AnalyticsPage gets API. No empresaId in requests; query keys keep scopes.

## 10. Tests obligatorios

Export whitelist/filter parity/limit/idempotency/status/download expiry/tenant; job crash/retry/lease when D-09; alert schedule idempotency/read isolation/retention; dashboard branch semantics and single source; SQL aggregate correctness; permissions, cursor, errors; frontend no xlsx path and polling cancellation.

## 11. Qué cierra

RF-REP-001..003, RF-NOT-001..002, endpoints #14, #58–#62, #69–#71, entity Alert, findings B3/A15/A20/M1–M6/M20 and pending P-20. IDs: RF-REP-001, RF-REP-002, RF-REP-003, RF-NOT-001, RF-NOT-002, R-ALE-1, B3, A15, A20, M1, M2, M3, M4, M5, M6, M20, P-20, 14, 58, 59, 60, 61, 62, 69, 70, 71, Alert.

## 12. Dependencias nuevas

D-09 may authorize queue/storage/worker dependency; none in the current plan. Do not install XLSX server library before selecting format/provider.

## 13. Decisiones abiertas

`[ABIERTO D-09]` production jobs/storage/observability/multi-instance; D-08 ids only affects fixtures. Export column policy is decided as names/whitelist by ADR-BE-011, not open.

## 14. Riesgos y trampas

No let client send accessor functions; no second dashboard source; no global alert read; no unbounded export/alert cursor; no signed URL without expiry; no worker claiming same job; no stale mock import in analytics.

## 15. Tamaño

Partir 10a exports/jobs and 10b alerts/dashboard/analytics. The cut isolates storage/worker operations from SQL projections/UI migration.

## 16. Lista cuando

Contracts/jobs/tables/RLS/tests pass; export/filter parity and signed download; alerts generated/read per user; dashboard/analytics one SQL source; frontend has no browser job/xlsx/static analytics; D-09 operational plan exists; checklist/report/gates and `docs:check BE-10` green.
