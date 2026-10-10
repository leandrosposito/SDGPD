# BE-03 — Productos, clientes y listas de precios

**Verificación:** 2026-10-10, `lean=e719e96c870244bc67756f3fa91f929315ef761c`. **Estado:** lista para implementar cuando BE-2 se mergee; las referencias a maestros son supuestos de `b1aedf5`.

## 1. Encabezado

Supuesto `[HECHO en rama]`: BE-2 entrega Supplier/DTOs/UUIDs cuando se mergee. No hay código BE-03 en `lean`; los detalles de la rama se consultan con `git show origin/sesion-be2-2026-10-10:<ruta>`.

## 2. Objetivo

Persistir productos, clientes y listas de precios por empresa, con búsqueda acotada, dinero en centavos, alícuota de IVA y contratos server-side que permitan a BE-05 resolver precios sin recibir totales del cliente.

## 3. Depende de

BE-2 para `supplierId` y contratos de búsqueda. BE-1 para sesión/RLS/permisos. BE-04 consume productos, lotes y stock; BE-05 consume clientes, `priceListId`, `taxRateBp` y dirección snapshot. D-03 bloquea precios por producto, pero no el alcance mínimo de lista por porcentaje.

## 4. ADRs

`[DECIDIDO]` ADR-BE-002: productos, clientes y listas son EMPRESA; no `branchId`. `[DECIDIDO]` ADR-BE-004: DTO camelCase, UUID v7, offset máximo 100, search acotado. `[DECIDIDO]` ADR-BE-006: Money centavos+moneda, servidor calcula IVA/totales, `taxRateBp=2100` por defecto, lista como porcentaje base. `[DECIDIDO]` ADR-BE-007: líneas usan `productId`, snapshots de SKU/nombre/precio/alícuota y cliente al confirmar. `[DECIDIDO]` ADR-016: ningún resolver consulta catálogo entero; selectores usan `q`/`limit`. Objeción de BE-006 sobre alícuota obliga BE-03 antes de BE-05.

## 5. Modelo de datos

Producto (`InventoryItem`, `02_MODELO_DE_DATOS.md:98-107`): `id uuid`, `empresa_id`, `sku`, `barcode nullable`, `name`, `description nullable`, `categoryCode`, `unitOfMeasureCode`, `status`, `supplierId nullable`, `cost Money nullable`, `basePrice Money`, `taxRateBp integer NOT NULL DEFAULT 2100`, `version`, timestamps. UNIQUE `(empresa_id,sku_normalized)` y barcode cuando no es null; FK compuesta a Supplier. Los lotes salen a BE-04; no se conserva `lots` embebido.

Cliente (`ClientAccount`, `02_MODELO_DE_DATOS.md:41-55`): maestro de empresa con nombre, CUIT, contactos, direcciones, condición IVA, vendedor opcional, `creditLimit Money`, `priceListId`, `saleConditionCode`, `isActive`, `version`; UNIQUE CUIT normalizado por empresa si el contrato final lo confirma. No persistir `transactions`, `currentBalance`, `daysOverdue`, `status` ni `balance` derivados: los ledger son BE-09.

Lista: `[PROPUESTO]` `price_lists(id,empresa_id,name,percentage_bp,active,version,created_at,updated_at)` y `price_list_products` queda fuera por D-03. UNIQUE nombre por empresa. Todas las tablas RLS FORCE y FK compuesta `(empresa_id,id)`. Índices para SKU/barcode/name, cliente CUIT/name/active y lista active/name. `branchId` no aparece. Los fields legacy `priceList`/`saleCondition` se renombran a ids/códigos; la UI conserva display.

## 6. Endpoints y contratos

Permisos: products/clients/prices × `ver|crear|editar`; todas las rutas `/api` y sin `empresaId`.

| Método/path | Request/response y list query | Reemplaza |
|---|---|---|
| GET `/api/products` | offset `{items,total,page,pageSize}`; search/active/supplierId; whitelist sku/name/price | #78 |
| GET/POST/PUT/DELETE `/api/products/:id` | DTO, create/update con version, baja lógica | #79–#81 |
| GET `/api/products/search` | `{items,truncated}`, `q/limit/active` | #78 server→server |
| GET/POST/PUT `/api/clients`, `/:id` | list DTO, create/update/version | #4, #6–#9 |
| GET `/api/clients/search` | selector acotado por q | #6 |
| GET `/api/price-lists`, `/:id`; POST/PUT | porcentaje, estado, version | UI TabPriceLists, sin fila previa en 01 |

Contratos en `packages/contracts` nuevos; request no manda totales, `empresaId` ni actor. Money `{amount,currency}`; errores `sku-duplicado`, `barcode-duplicado`, `client-cuit-duplicado`, `not-found`, `version-conflict`, `invalid-query`. Accounts/overdue (#10–#13) pasan a BE-09, aunque sus filtros de cliente nacen aquí.

## 7. Reglas de negocio

R-PRD-1..6: SKU/barcode únicos case-insensitive, existencia/version, baja lógica y exclusión de inactivos donde corresponde; R-CLI-1..4: validar CUIT/campos, cliente activo, saldos derivados por ledger y monedas separadas. `[DECIDIDO]` `taxRateBp` default 2100 para existentes; el servidor calcula precio base × porcentaje, descuento permitido solo según contrato y IVA half-up por línea. No se acepta precio/tax/total del cliente. El alta/edición y la lista son comandos transaccionales y auditados. La exposición de crédito se decide en BE-05/BE-09.

## 8. Seed y datos

Migrar 19 productos, 30 clientes y 3 listas actuales con UUID deterministas; reparar Supplier IDs usando los UUID de BE-2 o dejar una referencia explícita faltante que haga fallar seed. Fechas de transacciones no se trasladan como ledger: son proyecciones legacy. Corregir `sup-999`/SKUs huérfanos antes del seed; no copiar `Supplier.products`, `ClientAccount.transactions` ni floats. D-03 impide sembrar precios por producto.

## 9. Arrastre frontend

Archivos: `FrontEnd/src/shared/api/products/{products.service,dto,mapper,productUpdate}.ts`, `FrontEnd/src/modules/clients/api/{clients.service,dto,mapper}.ts`, `FrontEnd/src/shared/types/{inventory,client}.types.ts`, formularios `ProductFormModal(.schema).tsx`, `CreateClientModal` y tabs, `ClientDirectoryTable`, `TabPriceLists`, `CreateOrderModal`.

Eliminar `empresaId` del request; conectar `products`, `clients`, `priceLists` en `VITE_HTTP_SERVICES`; DTOs validan UUID/Money; reemplazar catalog full por search server-side en selectores (debounce+AbortController); añadir tax rate; convertir prices/creditLimit a Money; eliminar transactions embebidas del mapper; mantener `companyId` en query keys, no en wire. La dirección final depende de D-05.

## 10. Tests obligatorios

RLS/empresa, permisos por módulo/acción, UUID/DTO strict, búsqueda limit/truncated, SKU/barcode/CUIT UNIQUE, version/idempotencia, baja lógica, taxRate default, Money y redondeo, listas por porcentaje, no aceptar totales client-side, referencias Supplier, seed y filtros de inactivos. Probar que un resolver nunca descarga catálogo completo y que AbortController cancela búsquedas.

## 11. Qué cierra

RF-CLI-001..006, RF-PRD-001..004, RF-PRI-001 y parcialmente RF-PRI-002..003 (D-03); endpoints #4–#9, #78–#81; entidad ClientAccount e InventoryItem; reglas R-CLI-1..4 y R-PRD-1..6; findings A16, M10–M12; P-7, P-18, P-21, P-22. IDs asignados explícitos: RF-CLI-001, RF-CLI-002, RF-CLI-003, RF-CLI-004, RF-CLI-005, RF-CLI-006, RF-PRD-001, RF-PRD-002, RF-PRD-003, RF-PRD-004, RF-PRI-001, RF-PRI-002, RF-PRI-003, R-CLI-1, R-CLI-2, R-CLI-3, R-CLI-4, R-PRD-1, R-PRD-2, R-PRD-3, R-PRD-4, R-PRD-5, R-PRD-6, A16, M10, M11, M12, P-7, P-18, P-21, P-22, 4, 5, 6, 7, 8, 9, 78, 79, 80, 81, ClientAccount (cliente + cuenta corriente), InventoryItem (producto).

## 12. Dependencias nuevas

Ninguna prevista. Si se requiere librería de búsqueda, dinero o UUID adicional, detenerse y registrar la dependencia; ya existen contracts/Zod/Money.

## 13. Decisiones abiertas

`[ABIERTO D-03]` precio por producto dentro de una lista; `[ABIERTO D-05]` dirección de entrega; `[ABIERTO D-07]` producto sin stock; `[ABIERTO D-08]` migración de ids demo. D-03 no bloquea el porcentaje mínimo, pero sí RF-PRI completo.

## 14. Riesgos y trampas

No tratar price list como texto; no sumar ARS/USD; no persistir saldos derivados; no usar SKU como FK; no aceptar floats; no llamar `fetchProducts` desde comandos; no hacer que `active=false` desaparezca del stock actual sin la regla de BE-04; no confundir account endpoints con el maestro de cliente.

## 15. Tamaño

Partir 3a productos/listas y 3b clientes si el contrato de crédito/direcciones crece. El corte es precio/catálogo independiente de cuenta corriente; BE-05 no empieza hasta tener ambos contratos estables.

## 16. Lista cuando

Tablas/migraciones/RLS desde cero; contracts y mappers verdes; todos los endpoints con permisos, paginación, idempotencia/version; Money y tax tests; seed determinista; frontend HTTP sin empresaId y selectors search; D-05/D-03 señaladas sin decisión fingida; ocho gates y `docs:check BE-03` verdes.
