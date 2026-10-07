# BackEnd/docs — Índice de la documentación del backend

**Fecha:** 2026-10-07. Hoy `BackEnd/` contiene **solo documentación**: no hay código, ni `package.json`, ni migraciones. El origen de todo lo de acá es la auditoría de solo lectura [`FrontEnd/docs/historial/auditorias/backend/`](../../FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md) (2026-10-07). Las 26 decisiones abiertas que dejó ([`08_DECISIONES_ABIERTAS.md`](../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md)) quedaron tomadas y documentadas en 11 ADRs.

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

Cada ADR tiene sus secciones de **Sub-decisiones tomadas al redactar** (pendientes de revisión) y **Objeciones** (choques con evidencia del repo, sin resolver).

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
| B1 | `empresaId` en 87 llamadas contra D1 | ADR-BE-002 | BE-0 (infra), cada módulo al conectarse |
| B2 | Sin auth; actor en el body | ADR-BE-003 | BE-1 |
| B3 | Exportación sin contrato HTTP | ADR-BE-011 | BE-10 |
| B4 | Wire indefinido | ADR-BE-004 | BE-0 (`contracts`), cada módulo |
| B5 | Cumplimiento parcial contradictorio | ADR-BE-008 | BE-5, BE-6, BE-8 |
| B6 | Dos mecanismos de rechazo; body de error descartado | ADR-BE-004 | BE-0 (`httpClient` + filtro de errores) |
| B7 | Nada mueve stock | ADR-BE-009 | BE-4, BE-5, BE-6, BE-8 |
| B8 | Formato de ids | ADR-BE-004 | BE-0 |
| A1 | 4 funciones sin `empresaId` en `dashboard.service.ts` | ADR-BE-011 (se retiran) | BE-10 |
| A2 | Reintento de POST sin idempotencia | ADR-BE-005 | BE-0 |
| A3 | Totales que manda el cliente | ADR-BE-006 | BE-5 |
| A4 | Sobreentrega posible | ADR-BE-008 | BE-6 |
| A5 | Dos caminos a `FINALIZADO` | ADR-BE-005 | BE-6, BE-7 |
| A6 | `requiereEvidencia` solo en la UI | — (regla de negocio sin ADR propio; la valida el comando `registrarEntrega`) | **BE-6** |
| A7 | Asignación a viaje sin validar estado ni sucursal | — (regla de negocio sin ADR propio) | **BE-7** |
| A8 | Fusión de OC sin moneda y pisando el precio | ADR-BE-006 (moneda, sub-decisión 6) | BE-8 (precio) |
| A9 | Recepción de OC sin cantidades ni stock | ADR-BE-008 + ADR-BE-009 | BE-8 |
| A10 | Remitos sin endpoint | ADR-BE-004 (sub-decisión 7) | BE-6 |
| A11 | Efectos cruzados no transaccionales | ADR-BE-005 | BE-6, BE-7 |
| A12 | Toasts con texto genérico en `http` | ADR-BE-004 | BE-0 |
| A13 | Concurrencia en un solo endpoint | ADR-BE-005 | BE-0 (infra), cada módulo |
| A14 | Idempotencia global; claves generadas al enviar | ADR-BE-005 | BE-0, BE-2 (vehículos y choferes), BE-6/7 (logística) |
| A15 | Alertas leídas globalmente; auditoría sin escritores | ADR-BE-005 (auditoría) + ADR-BE-011 (alertas) | BE-0, BE-10 |
| A16 | Dinero en float | ADR-BE-006 | cada módulo con importes (BE-3, BE-5, BE-8, BE-9) |
| A17 | Permisos sin enforcement; `USER_ROLE` fijo | ADR-BE-003 | BE-1 |
| A18 | `BackEnd/` en `.gitignore` | ADR-BE-001 | **cerrado** en el Paso 0 de la sesión de ADRs (`509963b`) |
| A19 | Reposición solicitada solo en el navegador | ADR-BE-009 (sub-decisión 5) | BE-4 |
| A20 | Analítica sin contrato | ADR-BE-011 | BE-10 |
| A21 | Nadie escribe la cuenta corriente | ADR-BE-010 | BE-9 (**sin débitos hasta que exista Facturación**, objeción 1 de ADR-BE-010) |

## Plan de tandas BE-0 a BE-10

Cada tanda pasa los 8 gates de ADR-BE-001 y sigue el protocolo de `FrontEnd/docs/PROTOCOLO.md` (fases A-E, merge `--no-ff` a `lean`). "Arrastra" es el trabajo de frontend que se hace en la misma tanda para conectar el módulo: cambiar al adaptador `http`, migrar el DTO a `contracts`, migrar el dinero a `Money`.

| Tanda | Construye | ADRs | Arrastra en el frontend |
|---|---|---|---|
| **BE-0** | `package.json` de workspaces; `packages/contracts` (base); esqueleto NestJS; Drizzle con migraciones SQL; interceptor de transacción y tenant (`SET LOCAL`); filtro de errores `{code, message, details}`; tabla e interceptor de idempotencia; tabla e interceptor de auditoría; infraestructura de paginación y listas blancas; suite de aislamiento (vacía, que crece por tabla) | 001, 002, 004, 005 | `httpClient`: leer el cuerpo de error, header `Idempotency-Key`, reintentar solo GET y mutaciones con clave. Validador de ids que acepta UUID + prefijo legado (ADR-BE-004, sub-decisión 1) |
| **BE-1** | empresas, sucursales, usuarios, sucursales habilitadas, roles y matriz módulo × acción; `/auth/*`; guard de permisos | 002, 003 | Login, logout, guard de rutas; `useSessionStore` contra `/auth/session`; `TabUsersRoles` con la matriz nueva; se elimina `USER_ROLE` |
| **BE-2** | proveedores, motivos, vehículos, choferes (maestros sin dependencias de negocio) | 004, 005 | Conectar suppliers, vehicles, drivers y motivos: DTO a `contracts` (suppliers era snake_case), `version` en las ediciones, clave al abrir el formulario (A14), sin `empresaId` en los requests |
| **BE-3** | productos (`taxRateBp`, `UNIQUE (empresa_id, sku)`, búsqueda acotada de ADR-016), clientes (sin `transactions` embebidas) | 004, 006, 007, ADR-016 | Conectar products y clients; `Money` en precios y límite de crédito; los selectores pasan a búsqueda server-side; campo de alícuota en `ProductFormModal` |
| **BE-4** | saldos de stock por sucursal y lote, kardex, ajustes, solicitudes de reposición | 009, 004 (cursor) | `TabStockCurrent`/`TabLowStock` con físico, reservado y disponible; `TabMovements`/`TabProductHistory` con cursor; `StockAdjustmentModal` conectado; `useReplenishmentStore` reemplazado; lotes fuera de `ProductFormModal` |
| **BE-5** | pedidos: alta y confirmación con snapshot, cálculo de importes en el servidor, reserva, cancelación, numeración `PED` | 006, 007, 009 | Conectar orders: líneas con `productId`, sin totales, vista previa con la función de `contracts`; `branchId` y dirección de entrega desde el modal; desaparece "avanzar estado"; `Money` |
| **BE-6** | entregas, despacho (baja física), remitos (`registrarEntrega` como único camino a `FINALIZADO`), rechazo y retorno, confirmación de recepción de devolución, `requiereEvidencia` (A6), sobreentrega | 005, 008, 009 | Conectar las entregas de logistics; endpoint de remitos en `DeliveryHistoryModal`; nueva acción de depósito para la devolución; clave al abrir (A14) |
| **BE-7** | viajes, paradas, asignación (validaciones de A7), POD como evidencia del remito, `markStopNoVisitada` todo-o-nada, posición y recorrido, uploads (ADR-005) | 005, 004 | Conectar trips: el POD deja de finalizar (`PodModal`); `NoEntregaModal` sin éxito parcial; uploads por `http`; clave al abrir en `TripDetailPanel` |
| **BE-8** | órdenes de compra (moneda, numeración `OC`, fusión por moneda), recepciones (numeración `REC`) con ingreso de stock | 006, 008, 009 | Conectar compras: formulario de recepción por línea; estado "Parcial" derivado; `Money` |
| **BE-9** | caja por sucursal (sesiones, apertura y cierre, arqueo), cuenta corriente append-only, recibos (`RCB`) e imputación | 010, 006 | Conectar cash (`branchId`, apertura y cierre) y la cuenta corriente de clients; `ClientAccountsTable`/`ClientOverdueTable` por moneda |
| **BE-10** | jobs de exportación, generación y lectura de alertas, endpoints de tablero (incluidos los 4 widgets) y de analítica | 011 | `useExportJob` contra `/exports`, columnas por nombre, sin `xlsx` en el navegador; se retira `useDashboard` y `dashboard.service.ts`; `AnalyticsPage` conectada |

**Fuera de BE-0..BE-10:** Facturación (RF-FAC-*, numeración fiscal; necesaria para que la cuenta corriente tenga débitos), Preparación/Despacho como entidades (RF-PRE-*, ADR-BE-008), listas de precios (RF-PRI-*; ver la objeción 1 de ADR-BE-006).

**Orden forzado por objeciones:** BE-3 (alícuota del producto) va antes de BE-5 (ADR-BE-006, objeción 2). BE-6 necesita resuelta la objeción 1 de ADR-BE-009 (líneas en `Delivery`) antes de implementar el despacho.
