# BE-05 — Pedidos y reserva

**Verificación:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** bloqueada por BE-03 y BE-04; `Order` del mock no es implementación backend.

## 1. Encabezado

No hay controller BE-05 en `lean`. Los contratos dependen de Product/Client/PriceList y los comandos de las tablas de stock de BE-04.

## 2. Objetivo

Crear y confirmar pedidos con sucursal de origen, líneas por producto, precio/alícuota resueltos server-side, snapshots inmutables, reserva atómica, cancelación segura y numeración `PED`.

## 3. Depende de

BE-03 para clientes activos, productos, taxRate y listas; BE-04 para reserva/available; BE-1 para actor/empresa; BE-06 consume deliveries y pendientes. D-05 afecta dirección. No implementar `advanceOrderStatus`.

## 4. ADRs

ADR-BE-006: Money, servidor calcula, IVA half-up y series. ADR-BE-007: eje comercial persistido, branch origen obligatorio, productId y snapshots; estado logístico/financiero derivado. ADR-BE-008: pendiente por línea, no subpedido. ADR-BE-009: reservar al confirmar y liberar al cancelar. ADR-BE-005: comando transaccional/idempotente/auditado. Objeciones resueltas: listas y taxRate obligan BE-3 previa; el seed recibe branch; “preparando” deriva de Delivery creada.

## 5. Modelo de datos

`orders(empresa_id,id,number,client_id,source_branch_id,commercial_status,source,notes,delivery_snapshot,version,confirmed_at,...)`; unique `(empresa_id,number)`. `order_lines(empresa_id,id,order_id,product_id,sku_snapshot,name_snapshot,quantity,unit_price_snapshot,discount_snapshot,tax_rate_bp_snapshot,delivered_quantity,version)`, FK compuestas e índices client/status/branch/date. `order_history` append-only actor/code/timestamp; no actor enviado. No persistir total client-side: total response se calcula desde snapshots/Money o se materializa dentro de transacción. `priceListId` queda en confirmación/snapshot. RLS EMPRESA; branch origen obligatorio pero pedido sigue alcance empresa con branch atributo.

## 6. Endpoints y contratos

Permisos orders × `ver|crear|editar|aprobar|cancelar`.

| Método/path | Contrato | Reemplaza |
|---|---|---|
| GET `/api/orders` | offset, filtros status/commercial/client/branch/date, whitelist sort, aggregates | #40 |
| GET `/api/orders/export` | job BE-10 con mismos filtros | #41 |
| POST `/api/orders` | draft/confirmed input sin totals/precios, idempotent | #42 |
| POST `/api/orders/:id/confirm` | price resolve, snapshot, reserve, number | nuevo, parte de #42 |
| POST `/api/orders/:id/cancel` | expectedVersion, releases reservation | #44 |
| GET `/api/orders/:id` | DTO con derived statuses/pending | #45 |

`#43 /advance` se retira. Request no lleva empresaId/actor; branchId es atributo/body y se valida. Responses `{order, totals, pendingToDispatch, pendingToDeliver}`; errors `client-not-found`, `inactive-client`, `product-not-found`, `inactive-product`, `no-items`, `stock-insufficient`, `credit-limit-exceeded` (control financiero integrado solo cuando corresponda), `version-conflict`, `has-active-deliveries`, `invalid-status`. `Idempotency-Key` obligatorio en POST; PUT/DELETE lo honran.

## 7. Reglas de negocio

R-PED-1/2/3/3b/3c validan items, cliente y productos; R-PED-4 se corrige: jamás aceptar subtotal/tax/total client-side; R-PED-5 usa counter transaccional sin consumir número en rechazo; R-PED-6 no permite sobreentrega (su aplicación real queda BE-06); R-PED-7 se elimina; R-PED-8/9/10 se reemplazan por estado comercial y cancelación atómica. Confirmar bloquea cliente/productos/stock en una transacción y toma snapshots; cantidad decimal según UOM; no split suborder. Cancelar libera reserva y no cancela Delivery activa. El comando de confirmación es uno solo: precio + IVA + number + order + reservation + history + audit.

## 8. Seed y datos

Migrar seis pedidos con SKU corregidos y asignar sucursal de origen según la objeción de ADR-BE-007; UUIDs de clientes/productos/listas reales. Recalcular totals, eliminar history inconsistente y fechas relativas. No importar `sellerName` como actor ni `items.sku` como FK; conservarlo solo snapshot.

## 9. Arrastre frontend

`FrontEnd/src/modules/orders/api/{orders.service,dto,mapper}.ts`, `CreateOrderModal.tsx`, `OrderProductsSection.tsx`, `OrderTotalsSection.tsx`, `OrderDeliverySection.tsx`, `OrderDetailPanel.tsx`, `OrdersPage.tsx`, `shared/api/products`, `shared/utils/money.ts`.

Eliminar totals/unitPrice del input enviado; enviar productId, priceListId, branchId y líneas; preview usa función de contracts; Money sustituye floats; dirección queda D-05; ocultar “avanzar estado”; confirm/cancel usan claves creadas al abrir; `VITE_HTTP_SERVICES` suma orders. Query keys companyId; no empresaId wire.

## 10. Tests obligatorios

Cliente/producto inactivo/no existe; totals manipulados; IVA/rate/rounding; lista/moneda; reserva exacta, insuficiente y concurrente; version conflict; cancelación con Delivery; number no consumido en error; replay idempotente; RLS/branch; history/audit actor; derived statuses/pending; seed; UI sin estado paralelo y URL filters.

## 11. Qué cierra

RF-PED-001..005, endpoints #40–#45 (con #43 retirado), entidad Order, reglas R-PED-1..10 y findings B5, A3. P-16 y P-17 quedan ligados a D-05. IDs: RF-PED-001, RF-PED-002, RF-PED-003, RF-PED-004, RF-PED-005, R-PED-1, R-PED-2, R-PED-3, R-PED-3b, R-PED-3c, R-PED-4, R-PED-5, R-PED-6, R-PED-7, R-PED-8, R-PED-9, R-PED-10, B5, A3, P-16, P-17, 40, 41, 42, 43, 44, 45, Order (pedido de venta).

## 12. Dependencias nuevas

Ninguna. Usa counter, Money, contracts y CommandTx existentes; si crédito exige Facturación, el bloqueo es D-01/BE-09, no una dependencia local.

## 13. Decisiones abiertas

`[ABIERTO D-05]` origen de dirección; D-01 condiciona solo enforcement de débitos/credit-limit completo; D-03 si se extiende precio específico. El modelo “no subpedido” y Delivery con líneas ya está decidido en ADR-BE-008.

## 14. Riesgos y trampas

No conservar status legado como segundo write model; no reservar al crear Delivery; no calcular en navegador; no hacer request anidado de catálogo entero; no cancelar con carrera de Delivery; no usar sucursal derivada si la reserva necesita branch origen.

## 15. Tamaño

Partir 5a alta/listado/snapshot y 5b confirm/reserva/cancelación. El corte es persistencia de pedido comercial versus efectos stock y numeración.

## 16. Lista cuando

Contracts, schema, RLS y counter verdes; confirmación/reserva/cancelación atómicas; todos los errores y locks probados; UI HTTP/money/URL migrada; #43 retirado sin consumidores; checklist/reporte/gates y `docs:check BE-05` verdes.
