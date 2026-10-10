# BE-06 — Entregas, remitos y devoluciones

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada por BE-05/BE-04; el alcance básico no espera D-04, pero RF-PRE queda en D-04.

## 1. Encabezado

No hay Delivery backend en `lean`. La fuente histórica `FrontEnd/src/modules/logistics/services/deliveries.service.ts` no es contrato.

## 2. Objetivo

Crear entregas con líneas fijadas, registrar remitos como único camino a FINALIZADO, actualizar pedido/stock/reserva en una transacción, manejar rechazo/evidencia/retorno y exponer historial de remitos.

## 3. Depende de

BE-05 Order y pending lines; BE-04 balances/lots/kardex; BE-1 permisos/empresa/branch. BE-07 consume Delivery y POD. D-04 solo bloquea entidades Preparación/Despacho adicionales, no el flujo Delivery decidido.

## 4. ADRs

ADR-BE-004: paths `/api`, DTO, `GET /deliveries/:id/delivery-notes`, errors. ADR-BE-005: idempotencia, transaction, audit; `registrarEntrega` único finalizador, POD no finaliza. ADR-BE-008: Delivery lines `orderLineId+dispatchedQuantity` inmutables, `FOR UPDATE`, two pending, delivered+rejected=dispatched. ADR-BE-009: baja al despachar, traslado reservation, return. ADR-001/002/005/013 aportan pendiente por línea, status y motivos. Objeciones resueltas: sobreentrega, POD y evidencia son server-side.

## 5. Modelo de datos

`deliveries(empresa_id,id,order_id,branch_id,status,date,estimated_window,client_snapshot,version,...)`, scope SUCURSAL; FK order/branch compuestas. `delivery_lines(empresa_id,id,delivery_id,order_line_id,dispatched_quantity,delivered_quantity,rejected_quantity)` unique delivery/order line. `delivery_notes` append-only with `REM` number, delivery/order, actor/timestamps/evidence; `delivery_note_lines` with delivered/rejected, reasonCode, returnInTransit. `delivery_history`, `rescheduling_events`, `return_receipts` append-only. RLS FORCE, branch enabled. `collectionAmount` Money not float; snapshot address follows D-05 or explicit command payload.

## 6. Endpoints y contratos

Permisos logistics × `ver|crear|editar|aprobar`; warehouse action for return receipt.

| Método/path | Contrato | Reemplaza |
|---|---|---|
| GET `/api/deliveries`/export | offset + job | #21–22 |
| POST `/api/deliveries` | orderId, branchId, line quantities, idempotent | #26 |
| GET `/api/deliveries/:id`, `/api/orders/:id/deliveries` | DTO/pending | #27 |
| POST `/api/deliveries/:id/transition` | allowed transitions, version | #23 |
| POST `/api/deliveries/:id/reschedule` | motivoCode, date, version | #24 |
| POST `/api/deliveries/:id/delivery-notes` | lines/evidence, idempotent | #25 |
| GET `/api/deliveries/:id/delivery-notes` | cursor/offset append-only | missing # in 01 / A10 |
| POST `/api/delivery-returns/:id/receive` | warehouse receipt | no endpoint |

No actor/empresaId in request; branch query/body only. Errors `order-not-confirmed`, `no-pending-lines`, `delivery-line-invalid`, `over-delivery`, `invalid-transition`, `motivo-invalido`, `evidence-required`, `return-not-ready`, `version-conflict`, `propagation-failed` is replaced by rollback. `Idempotency-Key` on commands.

## 7. Reglas de negocio

R-ENT-1..13: transition valid; append history actor session; reschedule validates type/code/OTRO and releases trip; register requires lines, quantities, reason/evidence; `disparaLogisticaInversa` creates return-in-transit; remito can be partial but dispatched quantities fixed; create requires confirmed order/pending/branch. A4/A5/A6/A10/A11 close. Transaction includes locks order lines, delivery, balances, note, order delivered qty, audit; failure rolls back all. `delivered+rejected=dispatched`; no second finalization by POD.

## 8. Seed y datos

Delivery mock relative dates become ISO fixed; no notes seed unless fixture; line quantities reference OrderLine UUIDs; reasons reference BE-2 Motivos; branch matches order source or explicit transfer rule. Existing `deliveryNotesStore` is not database seed. Return cases need fixture for evidence and manual receipt.

## 9. Arrastre frontend

`FrontEnd/src/modules/logistics/services/deliveries.service.ts`, `pod.service.ts`, order service/UI, `CreateDeliveryModal.tsx`, `RegistrarEntregaModal.tsx`, `DeliveryHistoryModal.tsx`, `ReprogramarModal.tsx`, `NoEntregaModal.tsx`, delivery tables/types.

DTO mappers validate branded ids; `DeliveryHistoryModal` calls new endpoint; `CreateDeliveryModal` selects line quantities with pending-dispatch default; lists display pending dispatch/delivery; `VITE_HTTP_SERVICES` adds deliveries; no empresaId/actor; key at modal open; Money for collection; UI no longer owns evidence/quantity guards, only assists. Prep UI remains behind D-04.

## 10. Tests obligatorios

RLS branch/tenant, confirmed/pending checks, fixed lines, concurrent overdelivery with `FOR UPDATE`, partial math, reason/evidence requirements, one finalization path, stock/reservation/order atomic rollback, reschedule releases trip, return receive once, version/idempotency, note history endpoint, permission warehouse action, D2 mock FK integrity.

## 11. Qué cierra

RF-ENT-001..004, endpoints #21–#29, entidades Delivery/DeliveryNote, rules R-ENT-1..13, findings A4/A5/A6/A10/A11, P-16/P-17 no (those are BE-05 address), and no RF-PRE because D-04. IDs: RF-ENT-001, RF-ENT-002, RF-ENT-003, RF-ENT-004, R-ENT-1, R-ENT-2, R-ENT-3, R-ENT-4, R-ENT-5, R-ENT-6, R-ENT-7, R-ENT-8, R-ENT-9, R-ENT-10, R-ENT-11, R-ENT-12, R-ENT-13, A4, A5, A6, A10, A11, 21, 22, 23, 24, 25, 26, 27, 28, 29, Delivery (entrega), DeliveryNote (remito).

## 12. Dependencias nuevas

Ninguna hasta BE-6; no object storage (ADR-BE-001). Upload interface begins BE-7; evidence ids may reference existing contract only.

## 13. Decisiones abiertas

`[ABIERTO D-04]` only if Preparation/Dispatch entities are added; `[ABIERTO D-05]` address; D-08 ids. No re-open of Delivery lines or finalization path.

## 14. Riesgos y trampas

No finalization from POD; no `cantidadOfrecida` as independent source; no cross-request stores; no server acceptance based on UI; no partial rollback; do not hide rejected/return quantities; do not put branchId in path.

## 15. Tamaño

Partir 6a delivery/lines/transitions and 6b notes/stock/returns. The cut is document creation versus cross-domain effects and return confirmation.

## 16. Lista cuando

Delivery lines/notes schema and DTOs exist; endpoint tests prove locks, atomicity, evidence, errors; UI history/line quantities wired; no mock store reads; D-04 explicitly scoped; report/checklist/eight gates and `docs:check BE-06` green.
