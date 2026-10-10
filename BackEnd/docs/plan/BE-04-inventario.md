# BE-04 — Inventario, kardex y reposición

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada hasta merge de BE-3; usa BE-2/3 como supuestos, no como código existente en `lean`.

## 1. Encabezado

No hay tablas ni controllers BE-04 en `lean`; el alcance se deriva de ADR-BE-009 y de `FrontEnd/src/modules/inventory/`.

## 2. Objetivo

Mantener por sucursal saldos físicos/reservados/disponibles, lotes, kardex append-only, ajustes auditados y solicitudes de reposición persistidas, con todos los movimientos transaccionales y consultables por cursor.

## 3. Depende de

BE-3 para `productId`, unidades, Money y producto activo; BE-1 para sucursal habilitada/RLS. BE-5 reserva al confirmar, BE-6 baja/retorno, BE-8 recepción; esos comandos deben usar las mismas tablas y ledger. P-14 y D-07 afectan la semántica de cero sin configuración.

## 4. ADRs

ADR-BE-009: kardex fuente de verdad, saldos materializados conciliables, reserva al confirmar, baja al despachar, traslado de reserva entre sucursales, retorno manual, FEFO, lotes por sucursal, no negativo y reposición persistida. ADR-BE-004: cursor para append-only, DTO strict y límites. ADR-BE-005: una transacción por ajuste/efecto cruzado. ADR-BE-002: stock/lotes/movimientos/reposición son SUCURSAL; `branchId` va query/body, nunca path. Objeciones de BE-009 sobre delivery lines y reserva trasladada son obligatorias.

## 5. Modelo de datos

`stock_balances(empresa_id,branch_id,product_id,physical_quantity,reserved_quantity,version,...)`, PK compuesta y FK empresa/sucursal/producto; `available=physical-reserved` derivado. `product_lots(empresa_id,branch_id,product_id,lot_number,expiration_date,quantity,quarantined,version)` unique por branch/product/lot. `inventory_movements` append-only con UUID, branch/product, kind, quantity, sourceType/sourceId, lotId nullable, actor, occurredAt; índice cursor `(branch_id,occurred_at,id)`. `product_history_events` puede ser proyección o vista, no segunda fuente. `replenishment_requests` por branch/product/supplier opcional, status, requested quantity, actor/version.

RLS FORCE en todas; FK compuestas; no floats, cantidades decimales según UOM de BE-3. Los campos `stock`, `minStock`, `sku`, `productName` se mapean; se descartan movement `user`/SKU como FK implícita y sugerencia persistida sin estado.

## 6. Endpoints y contratos

Permisos inventory × `ver|crear|editar|aprobar` según matriz.

| Método/path | Contrato | Reemplaza |
|---|---|---|
| GET `/api/inventory/stock` | offset por branch, search/product/status, aggregates | #83, #85 |
| GET `/api/inventory/stock/export` | job BE-10, no filas ilimitadas | #84, #86 |
| GET `/api/inventory/movements` | cursor, filtros product/lot/type/date, nextCursor | #15 |
| GET `/api/inventory/product-history` | cursor y filtros | #17 |
| POST `/api/inventory/adjustments` | idempotent, motivo, lines, expected versions | #82 / UI huérfana |
| GET/POST `/api/inventory/replenishment` | cursor/lista y solicitud persistida | #19, #20 |
| POST `/api/inventory/replenishment/:id/approve|cancel` | comando auditado | RF-CMP-004 cross-over |

Todos `/api`, `branchId` query/body y sin empresaId. Errores: `stock-insufficient`, `negative-stock`, `version-conflict`, `invalid-lot`, `invalid-adjustment`, `already-requested`, `branch-not-enabled`; cursor máximo definido en contracts. Los exports se entregan a BE-10.

## 7. Reglas de negocio

R-INV-1 deja de ser “nada modifica”: cada comando escribe saldo/kardex en una transacción; R-INV-2 excluye inactivos de sugerencias. Ajuste exige motivo y no produce negativo; reserva no puede exceder available; baja física reduce physical y reserved según el origen; retorno entra en tránsito y solo recepción manual reingresa; recepción OC suma stock; FEFO selecciona lote salvo lote explícito; reposición única por producto/sucursal evita duplicados. `sourceId` conecta movimiento con pedido, remito, recepción o ajuste. El corte transaccional incluye todos los balances y movimientos afectados.

## 8. Seed y datos

Importar `productStock.data.ts`, lotes y movimientos con fechas absolutas/ISO, branch real y product UUID. No copiar `ProductStock.stock` como único saldo sin reserved; reconciliar lotes y balances. Generar solicitudes solo si el mock las representa; el estado “solicitado” del store no es evidencia. Corregir inv-019 según D-07, no ocultarlo.

## 9. Arrastre frontend

Rutas: `FrontEnd/src/shared/api/products/products.service.ts`; `FrontEnd/src/modules/inventory/api/{movements,product-history,purchase-suggestions}/`; `TabStockCurrent.tsx`, `TabLowStock.tsx`, `TabMovements.tsx`, `TabProductHistory.tsx`, `StockAdjustmentModal.tsx`, `TabPurchases.tsx`, `state/useReplenishmentStore.ts`; tipos `FrontEnd/src/shared/types/inventory.types.ts`.

Eliminar store de reposición y derivaciones client-side; sumar inventory a `VITE_HTTP_SERVICES`; query keys incluyen companyId+branchId; cursor en append-only; Money/quantities vienen DTO; stock adjustment pasa de huérfano a call-site; export usa job. Lotes salen del ProductFormModal y se consultan por branch.

## 10. Tests obligatorios

RLS por empresa/sucursal, sucursal no habilitada, reserved/available, no negativo, concurrencia de dos reservas/ajustes, kardex append-only, conciliación saldo-kardex-lotes, FEFO/quarantined, retorno manual, recepción, reposición duplicada y cancelación, cursor estable, aggregates server-side, idempotencia y actor de sesión. D2 de integridad de mocks debe correr antes y después del seed.

## 11. Qué cierra

RF-INV-001..007, endpoints #15–#20 y #82–#86, entidades PurchaseSuggestion, ProductStock, InventoryMovement, ProductHistoryEvent, reglas R-INV-1..2, findings B7, A19, M14–M18 y pendientes P-9, P-10, P-11, P-14. RF-CMP-004 y P-7 reciben solo el componente de reposición; la OC completa queda en BE-08. IDs: RF-INV-001, RF-INV-002, RF-INV-003, RF-INV-004, RF-INV-005, RF-INV-006, RF-INV-007, R-INV-1, R-INV-2, B7, A19, M14, M15, M16, M17, M18, P-9, P-10, P-11, P-14, 15, 16, 17, 18, 19, 20, 82, 83, 84, 85, 86, PurchaseSuggestion, ProductStock, InventoryMovement (kardex), ProductHistoryEvent.

## 12. Dependencias nuevas

Ninguna; cursor, Money, Zod y `CommandTx` existen. Storage/export no se agrega aquí.

## 13. Decisiones abiertas

`[ABIERTO D-07]` cero sin fila de stock; `[ABIERTO D-08]` ids demo; D-06 recepción afecta el comando de BE-08, no impide construir balances y ledger; RF-INV-004 requiere futura entidad de transferencia y queda fuera.

## 14. Riesgos y trampas

No calcular available en frontend; no usar SKU como FK; no escribir solo saldo sin kardex; no permitir negativos por carrera; no confundir movimiento de retorno con reingreso; no usar offset en movimientos; no crear sugerencias a partir del catálogo completo.

## 15. Tamaño

Partir 4a saldos/lotes/kardex y 4b ajustes/reposición. El corte es ledger mínimo que habilita reserva contra comandos posteriores versus flujos de UI/reposición.

## 16. Lista cuando

Migraciones/RLS, cursor y contracts verdes; invariantes conciliables; todos los efectos cruzados tienen transacción; no negativo/concurrencia/idempotencia cubiertos; seed reproducible; frontend conectado sin store paralelo; export delegado a BE-10; checklist, reporte, gates y `docs:check BE-04` verdes.
