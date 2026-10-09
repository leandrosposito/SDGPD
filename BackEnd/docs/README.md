# BackEnd/docs — Índice de la documentación del backend

**Fecha:** 2026-10-09. **BE-0a está hecha** (2026-10-08): `BackEnd/` tiene el esqueleto NestJS, la base con RLS y las suites de aislamiento. **BE-0b está hecha** (2026-10-09): idempotencia, `version`, auditoría, contadores y helpers de paginación, más el arrastre de `httpClient` en el frontend; la estructura está en [`ARQUITECTURA.md`](ARQUITECTURA.md) y el entorno, en [`SETUP_SUPABASE.md`](SETUP_SUPABASE.md). El origen de todo lo de acá es la auditoría de solo lectura [`FrontEnd/docs/historial/auditorias/backend/`](../../FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md) (2026-10-07). Las 26 decisiones abiertas que dejó ([`08_DECISIONES_ABIERTAS.md`](../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md)) quedaron tomadas y documentadas en 11 ADRs.

## ADRs

| ADR | Tema |
|---|---|
| [ADR-BE-001](adr/ADR-BE-001-stack-repositorio.md) | Stack, repositorio (monorepo), Drizzle, `packages/contracts`, testing, gates de tanda |
| [ADR-BE-002](adr/ADR-BE-002-tenancy-rls.md) | Tenancy desde la sesión, RLS forzado, FK compuestas, `branchId`, alcances |
| [ADR-BE-003](adr/ADR-BE-003-autenticacion-permisos.md) | Access + refresh token, usuario único, roles y matriz módulo × acción, actor desde la sesión |
| [ADR-BE-004](adr/ADR-BE-004-contrato-http.md) | UUID v7, DTO en `contracts`, fechas, paths, errores 4xx con `code`, paginación offset/cursor |
| [ADR-BE-005](adr/ADR-BE-005-mutaciones.md) | Idempotencia por header, `version`, transacción por comando, auditoría genérica |
| [ADR-BE-006](adr/ADR-BE-006-dinero-numeracion.md) | Centavos y moneda, importes calculados en el servidor, IVA por producto, numeración por serie |
| [ADR-BE-007](adr/ADR-BE-007-pedido.md) | Eje comercial persistido, sucursal de origen, `productId` en las líneas, snapshot al confirmar |
| [ADR-BE-008](adr/ADR-BE-008-cumplimiento-parcial.md) | Pendiente por línea (venta y compra), recepción como documento, preparación diferida |
| [ADR-BE-009](adr/ADR-BE-009-inventario.md) | Kardex fuente de verdad, reserva, baja al despachar, retorno, lotes por sucursal |
| [ADR-BE-010](adr/ADR-BE-010-cuenta-corriente-caja.md) | Cuenta corriente append-only (débito por factura), caja por sucursal con apertura y cierre |
| [ADR-BE-011](adr/ADR-BE-011-exportacion-alertas-tablero.md) | Exportación por job en el servidor, alertas por job y leídas por usuario, una sola fuente de tablero |

**Cierre del 2026-10-08:** las **74 sub-decisiones** quedaron **aprobadas** (con una corrección: Node 24 LTS en lugar de Node 22, ADR-BE-001 sub-decisión 1) y las **23 objeciones** quedaron **resueltas**, cada una con su línea "Resolución (2026-10-08)" debajo del texto original, que se conserva como historia. La tabla de objeciones de más abajo dice dónde quedó cada resolución. Al aplicarlas aparecieron **2 objeciones nuevas** (ADR-BE-002 objeción 3 y ADR-BE-004 objeción 3), **resueltas en el Paso 0 de la sesión BE-0a** (2026-10-08).

## Trazabilidad: las 26 decisiones de `08_DECISIONES_ABIERTAS.md`

| # | Decisión (08) | ADR | Sección |
|---|---|---|---|
| 1 | De dónde sale el tenant | ADR-BE-002 | Decisión 1-2 |
| 2 | Autenticación, sesión, usuario unificado | ADR-BE-003 | Decisión 1-6 |
| 3 | Formato de ids | ADR-BE-004 | Decisión › Ids |
| 4 | Forma del wire | ADR-BE-004 | Decisión › DTO |
| 5 | Exportación | ADR-BE-011 | Decisión › Exportación |
| 6 | Cumplimiento parcial de venta | ADR-BE-008 | Decisión › Venta |
| 7 | Preparación → Despacho | ADR-BE-008 | Decisión › Preparación |
| 8 | Recepción parcial de compras | ADR-BE-008 | Decisión › Compra |
| 9 | Relación pedido ↔ sucursal | ADR-BE-007 | Decisión 3 |
| 10 | Cuándo se mueve el stock | ADR-BE-009 | Decisión 1-7 |
| 11 | Dinero en el wire y en la base | ADR-BE-006 | Decisión 1-3 |
| 12 | Cómo se devuelven los rechazos | ADR-BE-004 | Decisión › Errores |
| 13 | Idempotencia | ADR-BE-005 | Decisión › Idempotencia |
| 14 | Concurrencia optimista | ADR-BE-005 | Decisión › Concurrencia |
| 15 | Paginación | ADR-BE-004 | Decisión › Paginación |
| 16 | Estado del pedido | ADR-BE-007 | Decisión 1-2 |
| 17 | Cuenta corriente | ADR-BE-010 | Decisión › Cuenta corriente |
| 18 | Alcance empresa/sucursal | ADR-BE-002 | Decisión 4 (el detalle de caja está en ADR-BE-010 › Caja) |
| 19 | SKU contra `productId` | ADR-BE-007 | Decisión 4 |
| 20 | Auditoría | ADR-BE-005 | Decisión › Auditoría |
| 21 | Alertas | ADR-BE-011 | Decisión › Alertas |
| 22 | Frontera transaccional | ADR-BE-005 | Decisión › Transacciones |
| 23 | Tablero y analítica | ADR-BE-011 | Decisión › Tablero y analítica |
| 24 | Snapshot y dirección del pedido | ADR-BE-007 | Decisión 5 |
| 25 | Numeración de otros documentos | ADR-BE-006 | Decisión 4 |
| 26 | Dónde vive el backend | ADR-BE-001 | Decisión 1 |

## Hallazgos BLOQUEANTE y ALTO de `00_RESUMEN.md`

| Id | Hallazgo (resumido) | Lo resuelve | Tanda que lo corrige |
|---|---|---|---|
| B1 | `empresaId` en 87 llamadas contra D1 | ADR-BE-002 | BE-0a (infra: RLS + `withTenant`), cada módulo al conectarse |
| B2 | Sin auth; actor en el body | ADR-BE-003 | BE-1 |
| B3 | Exportación sin contrato HTTP | ADR-BE-011 | BE-10 |
| B4 | Wire indefinido | ADR-BE-004 | BE-0a (`contracts` base), cada módulo |
| B5 | Cumplimiento parcial contradictorio | ADR-BE-008 | BE-5, BE-6, BE-8 |
| B6 | Dos mecanismos de rechazo; body de error descartado | ADR-BE-004 | BE-0a (filtro de errores), BE-0b (`httpClient`) |
| B7 | Nada mueve stock | ADR-BE-009 | BE-4, BE-5, BE-6, BE-8 |
| B8 | Formato de ids | ADR-BE-004 | BE-0a (UUID v7 en el servidor), BE-0b (validador del frontend) |
| A1 | 4 funciones sin `empresaId` en `dashboard.service.ts` | ADR-BE-011 (se retiran) | BE-10 |
| A2 | Reintento de POST sin idempotencia | ADR-BE-005 | BE-0b |
| A3 | Totales que manda el cliente | ADR-BE-006 | BE-5 |
| A4 | Sobreentrega posible | ADR-BE-008 | BE-6 |
| A5 | Dos caminos a `FINALIZADO` | ADR-BE-005 | BE-6, BE-7 |
| A6 | `requiereEvidencia` solo en la UI | — (regla de negocio sin ADR propio; la valida el comando `registrarEntrega`) | **BE-6** |
| A7 | Asignación a viaje sin validar estado ni sucursal | — (regla de negocio sin ADR propio) | **BE-7** |
| A8 | Fusión de OC sin moneda y pisando el precio | ADR-BE-006 (moneda, sub-decisión 6) | BE-8 (precio) |
| A9 | Recepción de OC sin cantidades ni stock | ADR-BE-008 + ADR-BE-009 | BE-8 |
| A10 | Remitos sin endpoint | ADR-BE-004 (sub-decisión 7) | BE-6 |
| A11 | Efectos cruzados no transaccionales | ADR-BE-005 | BE-6, BE-7 |
| A12 | Toasts con texto genérico en `http` | ADR-BE-004 | BE-0b |
| A13 | Concurrencia en un solo endpoint | ADR-BE-005 | BE-0b (infra), cada módulo |
| A14 | Idempotencia global; claves generadas al enviar | ADR-BE-005 | BE-0b, BE-2 (vehículos y choferes), BE-6/7 (logística) |
| A15 | Alertas leídas globalmente; auditoría sin escritores | ADR-BE-005 (auditoría) + ADR-BE-011 (alertas) | BE-0b, BE-10 |
| A16 | Dinero en float | ADR-BE-006 | cada módulo con importes (BE-3, BE-5, BE-8, BE-9) |
| A17 | Permisos sin enforcement; `USER_ROLE` fijo | ADR-BE-003 | BE-1 |
| A18 | `BackEnd/` en `.gitignore` | ADR-BE-001 | **cerrado** en el Paso 0 de la sesión de ADRs (`509963b`) |
| A19 | Reposición solicitada solo en el navegador | ADR-BE-009 (sub-decisión 5) | BE-4 |
| A20 | Analítica sin contrato | ADR-BE-011 | BE-10 |
| A21 | Nadie escribe la cuenta corriente | ADR-BE-010 | BE-9 (**sin débitos hasta que exista Facturación**, objeción 1 de ADR-BE-010) |

## Plan de tandas BE-0 a BE-10

**BE-0 se dividió en dos (2026-10-08):** **BE-0a** es la base (monorepo, contratos, esqueleto, base con RLS y suite de aislamiento, sin endpoints de negocio ni autenticación) y **BE-0b** es el resto de la infraestructura de mutaciones que el plan original ponía en BE-0 (idempotencia, `version`, auditoría, contadores y helpers de paginación). BE-0b va antes de BE-1.

Cada tanda pasa los 8 gates de ADR-BE-001 y sigue el protocolo de `FrontEnd/docs/PROTOCOLO.md` (fases A-E, merge `--no-ff` a `lean`). "Arrastra" es el trabajo de frontend que se hace en la misma tanda para conectar el módulo: cambiar al adaptador `http`, migrar el DTO a `contracts`, migrar el dinero a `Money`.

| Tanda | Construye | ADRs | Arrastra en el frontend |
|---|---|---|---|
| **BE-0a** (hecha 2026-10-08) | `package.json` de workspaces (`BackEnd` y `packages/*`; **`FrontEnd` todavía no**) con el lockfile en la raíz; `packages/contracts` (base transversal: id, cuerpo de error, envoltorios offset y cursor, fecha, instante, dinero); esqueleto NestJS (config validada con Zod, filtro global de errores `{code, message, details}`, `ZodValidationPipe`, `X-Request-Id`, `GET /health`); roles y schemas en Supabase (`sdgpd_migrator`, `sdgpd_app`, `sdgpd_app_test`; `sdgpd` y `sdgpd_test`); Drizzle con migraciones SQL y runner propio; `companies` y `branches` con RLS forzado; `Database.withTenant` (`set_config(..., true)`); suite de catálogo y suite funcional de aislamiento | 001, 002, 004 | Nada: `FrontEnd/` no cambia en esta tanda |
| **BE-0b** (hecha 2026-10-09) | Tabla e interceptor de idempotencia (**`/auth/*` exento**); `version` en agregados editables (409 con `details.currentVersion`); tabla e interceptor de auditoría; contadores por empresa y serie (ADR-BE-006 §Decisión 4); helpers de paginación (offset y cursor) y listas blancas de filtros y orden. **`user_id` de `idempotency_keys` y `audit_log` queda sin FK: la agrega BE-1** | 004, 005, 006 | `httpClient`: leer el cuerpo de error, header `Idempotency-Key`, reintentar solo GET y mutaciones con clave. Validador de ids que acepta UUID + prefijo legado (ADR-BE-004, sub-decisión 1). **`FrontEnd/CLAUDE.md`** se actualiza en la tanda que sume `FrontEnd` a los workspaces (ADR-BE-001, objeción 3 y sub-decisión 14) |
| **BE-1** | empresas, sucursales, usuarios, sucursales habilitadas, roles y matriz módulo × acción; `/auth/*`; guard de permisos; la autenticación llama a `bindActor` (único punto de entrada del actor, BE-0b); **FK de `user_id` en `idempotency_keys` y `audit_log`** | 002, 003 | Login, logout, guard de rutas; `useSessionStore` contra `/auth/session`; `TabUsersRoles` con la matriz nueva; se elimina `USER_ROLE` |
| **BE-2** | proveedores, motivos, vehículos, choferes (maestros sin dependencias de negocio) | 004, 005 | Conectar suppliers, vehicles, drivers y motivos: DTO a `contracts` (suppliers era snake_case), `version` en las ediciones, clave al abrir el formulario (A14), sin `empresaId` en los requests |
| **BE-3** | productos (`taxRateBp`, **`2100` por defecto para los existentes**, `UNIQUE (empresa_id, sku)`, búsqueda acotada de ADR-016), clientes (sin `transactions` embebidas), **listas de precios** (alcance EMPRESA, porcentaje sobre el precio base, se siembran las 3 actuales) | 004, 006, 007, ADR-016 | Conectar products y clients; `Money` en precios y límite de crédito; los selectores pasan a búsqueda server-side; campo de alícuota en `ProductFormModal`; `ClientAccount.status` pasa a código (`al-dia`/`con-deuda`) y el texto lo arma la tabla |
| **BE-4** | saldos de stock por sucursal y lote, kardex, ajustes, solicitudes de reposición | 009, 004 (cursor) | `TabStockCurrent`/`TabLowStock` con físico, reservado y disponible; `TabMovements`/`TabProductHistory` con cursor; `StockAdjustmentModal` conectado; `useReplenishmentStore` reemplazado; lotes fuera de `ProductFormModal` |
| **BE-5** | pedidos: alta y confirmación con snapshot, cálculo de importes en el servidor (precio resuelto por `priceListId`), reserva, cancelación, numeración `PED`. **Asignarle sucursal de origen al seed** (ADR-BE-007, objeción 2) | 006, 007, 009 | Conectar orders: líneas con `productId` y `priceListId` en el pedido, sin totales ni precios, vista previa con la función de `contracts`; `OrderProductsSection` deja de aplicar el `modifier` de la lista; `branchId` y dirección de entrega desde el modal; desaparece "avanzar estado" (y no hay acción manual de "poner en preparación"); `Money` |
| **BE-6** | entregas **con líneas** (`order_line_id` + cantidad despachada, fijadas al crear, con `SELECT … FOR UPDATE` sobre las líneas del pedido), despacho (baja física por esas cantidades, **con traslado de reserva** si sale de otra sucursal), remitos (`registrarEntrega` como único camino a `FINALIZADO`, `entregada + rechazada = despachada`), rechazo y retorno, confirmación de recepción de devolución, `requiereEvidencia` (A6), sobreentrega | 005, 008, 009 | Conectar las entregas de logistics; **`CreateDeliveryModal` elige la cantidad por línea, con el pendiente de despachar por defecto** (ADR-BE-008, objeción 1); los listados de pedido muestran los dos pendientes (de despachar y de entregar); endpoint de remitos en `DeliveryHistoryModal`; nueva acción de depósito para la devolución; clave al abrir (A14) |
| **BE-7** | viajes, paradas, asignación (validaciones de A7), POD como evidencia del remito, `markStopNoVisitada` todo-o-nada, posición y recorrido, uploads (ADR-005). **Primera tanda con archivos:** interfaz de storage (disco local en desarrollo, object storage S3-compatible en producción, URLs firmadas con vencimiento; ADR-BE-011 §Storage) | 005, 004, 011 | Conectar trips: el POD deja de finalizar (`PodModal`) y **gana las líneas de la entrega, con la cantidad despachada precargada como entregada** (ADR-BE-005, objeción 2); `NoEntregaModal` sin éxito parcial; `allowedTransitions[].motivoCode` en lugar de texto; uploads por `http`; clave al abrir en `TripDetailPanel` |
| **BE-8** | órdenes de compra (moneda, numeración `OC`, fusión por moneda), recepciones (numeración `REC`) con ingreso de stock | 006, 008, 009 | Conectar compras: formulario de recepción por línea; estado "Parcial" derivado; `Money` |
| **BE-9** | caja por sucursal (sesiones, apertura y cierre, arqueo), cuenta corriente append-only, recibos (`RCB`) e imputación, control de límite de crédito (`credit-limit-exceeded`, forzable con el permiso "aprobar"). **Prerrequisito: ADR de Facturación** (factura interna no fiscal primero, electrónica fiscal después), sin el cual la cuenta corriente no recibe débitos (ADR-BE-010, objeción 1) | 010, 006, ADR de Facturación | Conectar cash (`branchId`, apertura y cierre) y la cuenta corriente de clients; `ClientAccountsTable`/`ClientOverdueTable` por moneda; aviso de límite de crédito al confirmar el pedido |
| **BE-10** | jobs de exportación, generación y lectura de alertas, endpoints de tablero (incluidos los 4 widgets) y de analítica | 011 | `useExportJob` contra `/exports`, columnas por nombre, sin `xlsx` en el navegador; se retira `useDashboard` y `dashboard.service.ts`; `AnalyticsPage` conectada |

**Fuera de BE-0..BE-10:** Preparación/Despacho como entidades (RF-PRE-*, ADR-BE-008) y los **precios por producto dentro de una lista** (RF-PRI-*, con su propio ADR; en BE-0..10 una lista es un porcentaje sobre el precio base). **Facturación dejó de estar fuera:** necesita su propio ADR y es **prerrequisito de BE-9** (ADR-BE-010, objeción 1).

**Orden forzado, ya resuelto:** **BE-3 antes de BE-5** (la alícuota del producto y las listas de precios tienen que existir para que el servidor pueda calcular un pedido; ADR-BE-006, objeciones 1 y 2). **El ADR de Facturación antes de BE-9** (ADR-BE-010, objeción 1). BE-6 ya no está bloqueado: las líneas de `Delivery` quedaron decididas en ADR-BE-008.

## Objeciones: las 23 y dónde quedó cada resolución

Todas resueltas el **2026-10-08**. El texto original de cada objeción se conserva en su ADR, con la resolución debajo.

| # | ADR | Objeción | Resolución (2026-10-08) | Dónde |
|---|---|---|---|---|
| 1 | BE-001 | La regla 2.2 prohíbe instalar dependencias y bloquea BE-0 | 2.2 acotada a `FrontEnd/`; en `BackEnd/` y `packages/`, solo las que liste la consigna de la tanda — el resto es condición de parada | ADR-BE-001 §Decisión 6 y objeción 1; `PROTOCOLO.md` §2.2 |
| 2 | BE-001 | npm workspaces mueve el lockfile a la raíz y rompe D8 | El lockfile solo cambia en una tanda que autorice dependencias, y su diff se corresponde con esa lista; BE-0 lo mueve por diseño | ADR-BE-001 objeción 2; `PROTOCOLO.md` §4 D8 |
| 3 | BE-001 | `FrontEnd/CLAUDE.md` queda desactualizado | Se actualiza en BE-0, la tanda que crea los workspaces | ADR-BE-001 objeción 3; plan BE-0 |
| 4 | BE-002 | Caja SUCURSAL contradecía el protocolo | Confirmado: cambio deliberado | ADR-BE-002 objeción 1 |
| 5 | BE-002 | "Reposición" sin entidad persistida | La crea `replenishment_requests` (ADR-BE-009 sub-decisión 5), en BE-4 | ADR-BE-002 objeción 2; ADR-BE-009 sub-decisión 5 |
| 6 | BE-003 | La cookie `HttpOnly` no cubre una app nativa | El login recibe el tipo de cliente: web → cookie, nativa → refresh en el body, con la misma rotación y detección de reuso | ADR-BE-003 §Decisión 1 y objeción 1 |
| 7 | BE-003 | `SameSite` con orígenes distintos | Frontend y API en el mismo site; en desarrollo, Vite hace proxy de `/api` | ADR-BE-003 objeción 2 |
| 8 | BE-004 | camelCase "de los tipos actuales" congela un vocabulario mezclado | No se renombra nada; dos reglas para que no empeore, y ningún valor de enum es texto de display (`al-dia`, `con-deuda`) | ADR-BE-004 §Decisión › DTO y objeción 1 |
| 9 | BE-004 | `allowedTransitions[].motivo` es texto de display | Pasa a ser un código kebab-case (`motivoCode`); el texto lo arma la UI | ADR-BE-004 objeción 2; enmienda de ADR-010 (§3) |
| 10 | BE-005 | Idempotencia obligatoria en todo POST incluiría `/auth/login` | `/auth/*` queda exento | ADR-BE-005 §Decisión › Idempotencia y objeción 1; ADR-BE-003 |
| 11 | BE-005 | Un solo camino a `FINALIZADO` contra el POD de la Tanda 10B | Confirmado; el POD gana las líneas, con la cantidad despachada precargada como entregada. Cambio de UI de BE-7 | ADR-BE-005 objeción 2; plan BE-7 |
| 12 | BE-006 | El precio sale de la lista elegida en la UI y el cliente ya no manda precios | Listas de precios como entidad EMPRESA (porcentaje sobre el precio base); el pedido manda `priceListId` y el servidor resuelve el precio | ADR-BE-006 §Decisión 3 y objeción 1; ADR-BE-002 §Alcances |
| 13 | BE-006 | `InventoryItem` no tiene alícuota | Se agrega en BE-3, con `2100` por defecto; BE-3 va antes que BE-5 | ADR-BE-006 objeción 2; plan BE-3 |
| 14 | BE-007 | "Solo el eje comercial" contra "en preparación sigue siendo un estado" | "En preparación" es derivado (alguna entrega en `CREADO`); no hay acción manual: crear la entrega es empezar a preparar | ADR-BE-007 §Decisión 1 y objeción 1; ADR-BE-008 §Preparación |
| 15 | BE-007 | Filtrar por sucursal de origen cambia los números del tablero | Aceptado; BE-5 le asigna sucursal de origen al seed | ADR-BE-007 objeción 2; enmienda de ADR-009; plan BE-5 |
| 16 | BE-008 | "Rechaza la sobreentrega" sin nada contra qué comparar: `Delivery` no tiene líneas | `Delivery` gana líneas (`orderLineId` + cantidad despachada) al crearse; validación con `SELECT … FOR UPDATE`; dos pendientes | ADR-BE-008 §Decisión › Venta y objeción 1; plan BE-6 |
| 17 | BE-008 | "En preparación sigue siendo un estado" contra BE-007 | El texto de este ADR quedó corregido; ver la objeción 14 | ADR-BE-008 §Preparación y objeción 2 |
| 18 | BE-009 | "Baja física al despachar" sin cantidades en la entrega | Resuelto por las líneas de `Delivery` (objeción 16) | ADR-BE-009 §Decisión 2 y objeción 1; ADR-BE-008 objeción 1 |
| 19 | BE-009 | Reserva en la sucursal de origen contra despacho desde otra | La reserva se traslada en la misma transacción y vive siempre donde sale la mercadería | ADR-BE-009 §Decisión 2, tabla de efectos y objeción 2 |
| 20 | BE-010 | El débito nace con la factura, y Facturación no tiene ADR ni tanda | La factura sigue siendo el origen; ADR de Facturación como prerrequisito de BE-9 (interna no fiscal primero). Hasta entonces, sin débitos: aceptado | ADR-BE-010 §Decisión y objeción 1; plan BE-9 |
| 21 | BE-010 | Nada define contra qué se compara `creditLimit` | Exposición = saldo + pedidos confirmados sin facturar; se controla al confirmar, 422 `credit-limit-exceeded`, forzable con "aprobar" y registrado | ADR-BE-010 §Decisión › Cuenta corriente y objeción 2 |
| 22 | BE-011 | "URL prefirmada" supone storage, contra "solo Postgres" | Interfaz única de storage: disco local en desarrollo, S3-compatible en producción desde BE-7; los archivos no van a Postgres | ADR-BE-011 §Storage y objeción 1; ADR-BE-001 §Decisión 2 |
| 23 | BE-011 | Retirar `fetchDashboardData` deja 4 widgets sin fuente | Resuelto por la sub-decisión 6: ADR-009 se extiende a esos 4 endpoints | ADR-BE-011 objeción 2; enmienda de ADR-009 |

**Objeciones nuevas, aparecidas al aplicar las resoluciones (resueltas en el Paso 0 de BE-0a, 2026-10-08):**

| ADR | Objeción | Resolución |
|---|---|---|
| BE-002, objeción 3 | El alcance EMPRESA gana "listas de precios", pero la enumeración de alcances de `PROTOCOLO.md` §1 no la incluye | `PROTOCOLO.md` §1 la incluye |
| BE-004, objeción 3 | La consigna de cierre ubica `allowedTransitions` en el §1 de ADR-010 y está en el §3 | Verificado: la enmienda quedó contra §3 (`ADR-010-modelo-logistico.md:224`). Cerrada sin cambios |

**Objeción nueva de BE-0b (2026-10-09), resuelta en el Paso 0 de BE-1a (2026-10-09):**

| ADR | Objeción | Estado |
|---|---|---|
| BE-005, objeción 3 | `httpClient` reintenta PUT/PATCH/DELETE con clave (§Decisión y consigna de BE-0b), pero las consecuencias para el frontend dicen que deja de reintentarlos, y el backend solo deduplica por clave los POST. Conectado, un PUT reintentado tras un timeout no duplica el efecto, pero puede devolver un 409 o un 422 espurio | **Resuelta, salida (a):** el backend honra `Idempotency-Key` también en PUT/PATCH/DELETE cuando viene (en POST sigue obligatoria), con las mismas reglas; el hash cubre body y parámetros de la ruta. El frontend no cambia. Corregidas las consecuencias para el frontend de ADR-BE-005 |
