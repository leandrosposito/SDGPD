# BE-08 — Órdenes de compra y recepciones

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada por BE-02/03/04 y D-06.

## 1. Encabezado

No hay OC/recepción backend en `lean`; la fuente actual es `FrontEnd/src/services/mock/purchaseOrders.service.ts` y ADR-BE-008.

## 2. Objetivo

Crear y gestionar órdenes de compra con moneda y serie `OC`, fusionar sugerencias sin mezclar moneda ni pisar precios, y registrar recepciones append-only `REC` que ingresen stock con estado parcial derivado.

## 3. Depende de

BE-2 Supplier, BE-3 Product/Money, BE-4 stock/kardex, D-06 shape de recepción. BE-9 no consume OC directamente salvo cuenta/proveedor fuera de alcance.

## 4. ADRs

ADR-BE-006: Money/moneda/series OC-REC y servidor calcula. ADR-BE-008: recepción documento append-only, líneas y estados partial/received derivados, no partición OC. ADR-BE-009: recepción suma stock en transacción. ADR-BE-002: OC empresa con sucursal destino obligatoria como atributo. ADR-BE-005: command/idempotency/version/audit.

## 5. Modelo de datos

`purchase_orders(empresa_id,id,number OC,supplier_id,destination_branch_id,currency,status,version,...)`; unique company/number. `purchase_order_lines` productId, ordered quantity, unit price Money, received derived from receipts. `purchase_receipts(empresa_id,id,number REC,purchase_order_id,branch_id,received_at,actor,version)` append-only; `purchase_receipt_lines` line, quantity, lot/expiration. FKs composite and RLS FORCE; indexes supplier/branch/status/date and receipt/order. No float, no `received` mutable field on OC as sole truth. Preserve UI `currency`, rename branch destination explicitly; discard client total.

## 6. Endpoints y contratos

Permisos purchases × `ver|crear|editar|aprobar|recibir`.

| Método/path | Contrato | Reemplaza |
|---|---|---|
| GET `/api/purchase-orders`/export | offset/job, filters supplier/branch/status/date, sort whitelist | #63–64 |
| GET `/api/suppliers/:id/purchase-orders` | bounded page | #65 |
| POST `/api/purchase-orders` | lines/Money/currency/branch, idempotent | #66 |
| POST `/api/purchase-orders/:id/transition` | allowed status/version | #67 |
| POST `/api/purchase-orders/from-suggestion` | product quantities, same currency merge | #68 |
| POST `/api/purchase-orders/:id/receive` | receipt lines, lots, idempotent | new / #67 received |
| GET `/api/purchase-orders/:id/receipts` | append-only cursor | new |

Errors `supplier-not-found`, `product-not-found`, `inactive-product`, `no-lines`, `invalid-line`, `currency-mismatch`, `over-receipt`, `invalid-transition`, `stock-write-failed`, `version-conflict`. No empresaId/actor. D-06 decides final receipt contract but every option must preserve append-only quantities.

## 7. Reglas de negocio

R-CMP-1..8: supplier exists, lines, quantities/prices, active product, valid transition, receipt quantities/stock (R-CMP-6 corrected), suggestion merge only same supplier/branch/currency and never overwrite existing price (R-CMP-7 corrected). Receipt quantity cannot exceed ordered−received; `partial` until all lines received, then `received`; cancel only before receipt. One receive command writes receipt, stock movements/lots and aggregates atomically.

## 8. Seed y datos

Use deterministic purchase orders, supplier/product UUIDs, absolute timestamps and currency-consistent suggestions. Add received quantities only through receipt fixtures; no direct status received. Repair supplier/product orphan IDs, retain six components only as UI snapshot, no price overwrite.

## 9. Arrastre frontend

`FrontEnd/src/services/mock/purchaseOrders.service.ts`, `FrontEnd/src/modules/compras/{ComprasPage.tsx,components/PurchaseOrderFormModal.tsx,components/PurchaseOrderDetailPanel.tsx,components/TabPendingReceipt.tsx}`, shared product/supplier services/types.

Move service to module api + DTO/mapper; add `purchase-orders` HTTP flag; receipt form by line; derived “Parcial”; Money all totals; idempotency at form open; branch destination body (no empresaId); remove client `computePurchaseOrderTotal` from server path; update selectors to search.

## 10. Tests obligatorios

RLS/company/branch, permissions receive vs edit, supplier/product FK, currency merge, price preservation, quantity integer/positive, transition/version/idempotency, partial/over receipt, receipt append-only and duplicate replay, stock/kardex atomic rollback, seed integrity, pagination/export same filters.

## 11. Qué cierra

RF-CMP-001..006, endpoints #63–#68, entity PurchaseOrder, rules R-CMP-1..8, findings A8/A9/M19, P-7 cross-over. IDs: RF-CMP-001, RF-CMP-002, RF-CMP-003, RF-CMP-004, RF-CMP-005, RF-CMP-006, R-CMP-1, R-CMP-2, R-CMP-3, R-CMP-4, R-CMP-5, R-CMP-6, R-CMP-7, R-CMP-8, A8, A9, M19, P-7, 63, 64, 65, 66, 67, 68, PurchaseOrder (orden de compra).

## 12. Dependencias nuevas

Ninguna sin decisión; receipt/storage no requiere object storage. Si D-06 elige proveedor o documento externo, debe autorizarlo.

## 13. Decisiones abiertas

`[ABIERTO D-06]` forma exacta de recepción; D-08 seed ids. D-03 price-per-product not needed for percentage list.

## 14. Riesgos y trampas

No mezclar monedas; no mutar OC a received sin receipt; no ingresar stock twice on replay; no derive received from a client field; no use supplier name as FK; no ignore destination branch; no overwrite unitPrice on merge.

## 15. Tamaño

Partir 8a OC/series/merge y 8b receipt/stock. El corte es documento de compra versus recepción cross-domain.

## 16. Lista cuando

Contracts/schema/RLS/tests pass; currency/merge/version/idempotency correct; receipt and stock atomic, partial derived; frontend form/receipt/Money connected; D-06 resolved; checklist/report/gates and `docs:check BE-08` green.
