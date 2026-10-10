# BE-07 — Viajes, paradas, POD y storage

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada por BE-06 y D-09 operativo; storage de desarrollo puede probarse con disco local.

## 1. Encabezado

No hay controllers BE-07 en `lean`. La implementación futura parte del modelo de `FrontEnd/src/modules/logistics/services/trips.service.ts` y ADR-BE-011.

## 2. Objetivo

Gestionar viajes y paradas con asignación validada, capacidad/version, transiciones y no-visita atómica; registrar POD como evidencia de remito, posición/recorrido y uploads con storage abstracto.

## 3. Depende de

BE-02 Vehicle/Driver/Motivo, BE-06 Delivery/Note, BE-1 actor/branch. D-09 bloquea S3/operación productiva; disco local permite desarrollo. No introduce Preparación.

## 4. ADRs

ADR-BE-004 DTO/path/error/pagination; ADR-BE-005 command transaction/version/idempotency and POD not finalizer; ADR-BE-011 storage local/S3 signed URLs. ADR-010 model Trip→Stop→Delivery→Line and motivoCode; ADR-011 capacity/list assignment/version/position/manual order; ADR-013 reschedule/no-visit. Objeciones: POD gains delivery lines, one path to FINALIZADO, `allowedTransitions[].motivoCode`.

## 5. Modelo de datos

`trips(empresa_id,id,branch_id,number VIA,vehicle_id,driver_id,date,status,version,capacity snapshot,position)`; `stops` separate with order/client snapshot/window/status; `stop_deliveries` join unique; `trip_events` append-only. `pods` append-only references delivery/stop/remit, receptor/evidence/upload ids, coordinates/timestamps; `storage_objects` metadata only, no file bytes in Postgres. RLS FORCE branch; vehicle/driver company FKs and enabled branch. Index trips branch/date/status, stops trip/order, POD delivery. `overrides` audit. UUID v7.

## 6. Endpoints y contratos

Permisos logistics × `ver|crear|editar|aprobar`; storage upload permission.

| Método/path | Contrato | Reemplaza |
|---|---|---|
| GET/POST `/api/trips` | offset/list and create | #30, #32 |
| GET `/api/trips/:id` | full trip | #31 |
| POST `/api/trips/:id/stops/:stopId/assign` | ids/filter max100, expectedVersion | #33 |
| POST `/api/trips/:id/transition` | version, motivoCode | #34 |
| PUT `/api/trips/:id/stops/order` | ordered ids/version | #35 |
| POST `/api/trips/:id/stops/:stopId/no-visitada` | all-or-nothing | #37 |
| POST `/api/trips/:id/stops/:stopId/pod` | POD evidence/remit lines | #36 |
| GET `/api/trips/:id/position`, `/route` | bounded position/cursor route | #38–#39 |
| POST `/api/uploads/sign`, `/confirm` | signed URL/metadata | non-http upload |

No branchId path/empresaId/actor. Errors: `vehicle-not-found`, `driver-not-found`, `delivery-not-assignable`, `branch-mismatch`, `trip-not-assignable`, `stale-version`, `exceeds-limit`, `exceeds-capacity`, `motivo-required`, `trip-not-in-course`, `stop-not-pending`, `no-deliveries`, `evidence-required`, `storage-failed`.

## 7. Reglas de negocio

R-VIA-1..15 retained and server-side: active/free vehicle/driver, trip/stop existence, version, max100, conflicts, delivery/trip/branch status, multidimensional capacity/override audit, transitions/version/effects, same stop set, POD membership, no-visit preconditions, all-or-nothing reprogram and release. A7 closes with branch/status validation; one transaction for assignment, no-visit, POD evidence+remit relation. `registerPod` never calls finalization alone.

## 8. Seed y datos

Convert trips/vehicles/drivers/deliveries to UUIDs from BE-2/6, fixed dates and branch links. GPS mock may seed deterministic route points; no fake production evidence. Evidence fixtures use metadata and local storage only. Validate every delivery/stop FK.

## 9. Arrastre frontend

`FrontEnd/src/modules/logistics/services/trips.service.ts`, deliveries/pod services, `TripsPage.tsx`, `CreateTripModal.tsx`, `TripDetailPanel.tsx`, `PodModal.tsx`, `NoEntregaModal.tsx`, `shared/api/uploads/uploads.service.ts`, `useEvidenceUpload.ts`.

Add DTO/mappers (P-22), replace `posicion`/`recorrido` paths, `motivoCode`, lines in POD prefilled dispatched quantity, no success partial, signed upload flow; add logistics to `VITE_HTTP_SERVICES`; keys at panel/modal open; no empresaId/actor. `TripLivePosition` already removes empty id sentinel, preserve required TripId.

## 10. Tests obligatorios

RLS branch, active/free resources, assignment conflicts/capacity/override, version races, invalid statuses/sucursal, transitions effects, stop reorder, all-or-nothing no-visit, POD evidence and no finalization, signed URL expiry/storage failures, idempotency, route cursor/position limits, permission matrix and actor audit.

## 11. Qué cierra

RF-LOG-001, RF-LOG-003, endpoints #30–#39, entities Trip/Pod, findings A7, M7, M8, M9, rules R-VIA-1..15, P-22 for logistics. IDs: RF-LOG-001, RF-LOG-003, R-VIA-1, R-VIA-2, R-VIA-3, R-VIA-4, R-VIA-5, R-VIA-6, R-VIA-7, R-VIA-8, R-VIA-9, R-VIA-10, R-VIA-11, R-VIA-12, R-VIA-13, R-VIA-14, R-VIA-15, A7, M7, M8, M9, P-22, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, Trip (viaje), Pod (prueba de entrega).

## 12. Dependencias nuevas

La consigna debe autorizar storage SDK solo si D-09 elige un proveedor concreto. Hasta entonces interfaz + disco local sin dependencia externa; no instalar ahora.

## 13. Decisiones abiertas

`[ABIERTO D-09]` storage/operación productiva; `[ABIERTO D-04]` Preparation fuera; D-08 ids. No reabrir jerarquía ni POD path.

## 14. Riesgos y trampas

No almacenar archivos en Postgres; no signed URLs sin expiry; no permitir Delivery finalizada/cancelada en asignación; no reusar versión sin compare; no finalizar desde POD; no mezclar sucursales; no borrar evidencia append-only.

## 15. Tamaño

Partir 7a viajes/asignación y 7b POD/storage. El corte separa transacciones de dominio de infraestructura de archivos.

## 16. Lista cuando

Tables/RLS/contracts/tests/gates pass; assignments/no-visit/POD atomic and versioned; storage local integration works and production D-09 documented; frontend mappers and uploads connected; checklist/report and `docs:check BE-07` green.
