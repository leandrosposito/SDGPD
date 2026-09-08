# AUDIT 05 — Reverificación manual de aislamiento empresa/sucursal

**Fecha:** 2026-09-07. **Commit base:** `6845ab1` (rama `corrida-completa`, derivada de `lean`).

Reverificación de la Fase 0.1 del prompt maestro de la corrida completa. AUDIT_5 (Fase A) ya concluyó que el aislamiento está bien, pero esa auditoría se corrió delegada a un fork; esta se hace a mano, línea por línea, sin delegar, porque es la afirmación de mayor riesgo del proyecto. Metodología: (1) leer `queryKeys.ts`, `usePagedQuery.ts`, `useCachedQuery.ts` completos para confirmar que `empresaId` es estructuralmente obligatorio; (2) grep exhaustivo de los dos únicos puntos de entrada al cache (`usePagedQuery(`, `useCachedQuery(`) sobre todo `src/modules` y `src/shared`; (3) para cada resultado, leer el archivo y confirmar si sus `filters`/`keyParams` incluyen `branchId` cuando el dominio es de alcance sucursal; (4) grep exhaustivo de `localStorage.`/`sessionStorage.` sobre todo `src/`.

## Por qué `empresaId` es estructural, no por convención

`pagedQueryKey`/`cachedQueryKey` (`src/shared/api/queryKeys.ts:26-33,68-72`) declaran `empresaId: string` como campo obligatorio de su interfaz de parámetros — sin `?`, sin default. `usePagedQuery` (`usePagedQuery.ts:122,144-151`) y `useCachedQuery` (`useCachedQuery.ts:106,110`) leen `empresaId` de `useSessionStore` **adentro del hook**, no como parámetro que cada consumidor deba recordar pasar — así que es físicamente imposible, en este código, invocar cualquiera de los dos hooks sin que `empresaId` termine en la query key. No hay una segunda vía de acceso al cache de TanStack Query en todo el proyecto (grep de `useQuery(`/`useQueryClient(` fuera de estos dos hooks: 0 resultados en `src/modules`).

## Tabla exhaustiva de query keys

Los 15 call-sites de `usePagedQuery` y los 9 de `useCachedQuery` — la totalidad de puntos de entrada al cache de TanStack Query en el proyecto (confirmado por grep, 24 resultados exactos, ninguno fuera de esta lista).

| Query key (archivo:línea) | Dominio | Alcance esperado | ¿Incluye `companyId`? | ¿Incluye `branchId`? | Veredicto |
|---|---|---|---|---|---|
| `CashPage.tsx:55` (`getCashTransactionsPage`) | Caja | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `ClientsPage.tsx:91` (`getClientsPage`) | Clientes (directorio) | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `ClientAccountsTable.tsx:61` (`getClientAccountsPage`) | Clientes (cuentas corrientes) | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `ClientOverdueTable.tsx:79` (`getOverdueClientsPage`) | Clientes (morosos) | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `TabPendingReceipt.tsx:88` (`getPurchaseOrdersPage`) | Compras (recepción pendiente) | EMPRESA (con filtro opcional de sucursal, ver A5 pregunta abierta #3) | Sí (vía hook) | `branchId` viaja como filtro OPCIONAL dentro de `PurchaseOrdersQueryFilters`, no como scope obligatorio — consistente con la decisión ya documentada en A5 | OK, alcance a confirmar (ver pregunta abierta, no bloqueante) |
| `ComprasPage.tsx:258` (`getPurchaseOrdersPage`) | Compras (listado principal) | EMPRESA (íd.) | Sí (vía hook) | Íd. — filtro opcional (`branchFilter`), no `activeBranchId` fijo | OK, alcance a confirmar |
| `TabLowStock.tsx:92` (`getLowStockPage`), filtros en línea 74-76 | Inventario — Bajo Stock Mínimo | SUCURSAL | Sí (vía hook) | **Sí** — `branchId` viaja en `filters` (línea 75), memoizado con `useMemo` dependiente de `branchId` (línea 76) | OK |
| `TabMovements.tsx:67` (`getMovementsPage`), filtros en línea 48-50 | Inventario — Movimientos | SUCURSAL | Sí (vía hook) | **Sí** — línea 49 | OK |
| `TabProductHistory.tsx:72` (`getProductHistoryPage`), filtros en línea 53-55 | Inventario — Historial de Producto | SUCURSAL | Sí (vía hook) | **Sí** — línea 54 | OK |
| `TabStockCurrent.tsx:86` (`getStockedProductsPage`), filtros en línea 68-70 | Inventario — Stock Actual | SUCURSAL | Sí (vía hook) | **Sí** — línea 69, y además `enabled: Boolean(branchId)` (línea 86) evita disparar sin sucursal | OK |
| `LogisticsPage.tsx:77` (`getDeliveriesPage`), filtros en línea 55-62 | Logística — Entregas | SUCURSAL | Sí (vía hook) | **Sí** — `branchId: activeBranchId` (línea 57), `enabled: activeBranchId !== null` (línea 77) | OK |
| `OrdersPage.tsx:110` (`getOrdersPage`) | Pedidos | EMPRESA | Sí (vía hook) | No — correcto (`Order` no tiene `branchId` en su tipo, confirmado en A5) | OK |
| `TabSubscription.tsx:42` (`getInvoicesPage`) | Settings — Suscripción/Facturas | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `TabUsersRoles.tsx:64` (`getUsersPage`) | Settings — Usuarios | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `SuppliersPage.tsx:83` (`fetchSuppliersPage`) | Proveedores | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `ComprasPage.tsx:113-115` (`useCachedQuery('suppliers-list', undefined, ...)`) | Proveedores (catálogo para combobox de OC) | EMPRESA | Sí (vía hook) | No — correcto (catálogo completo, no de sucursal) | OK |
| `ComprasPage.tsx:125-127` (`useCachedQuery('products', undefined, ...)`) | Productos (catálogo para combobox de OC) | EMPRESA (transversal, `shared/api/products/`) | Sí (vía hook) | No — correcto | OK |
| `InventoryPage.tsx:85` (`useCachedQuery('products', undefined, ...)`) | Productos (catálogo) | EMPRESA (transversal) | Sí (vía hook) | No — correcto | OK |
| `InventoryPage.tsx:100-102` (`useCachedQuery('suppliers-list', undefined, ...)`) | Proveedores (catálogo) | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `CreateOrderModal.tsx:39-41` (`useCachedQuery('products', undefined, ...)`) | Productos (catálogo para alta de pedido) | EMPRESA (transversal) | Sí (vía hook) | No — correcto | OK |
| `TabUsersRoles.tsx:75-77` (`useCachedQuery('settings-permissions-matrix', undefined, ...)`) | Settings — Matriz de permisos | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `AuditLogWidget.tsx:25-27` (`useCachedQuery('settings-audit-log', undefined, ...)`) | Settings — Auditoría | EMPRESA | Sí (vía hook) | No — correcto | OK |
| `SupplierDetailPanel.tsx:96-98` (`useCachedQuery('purchase-orders-by-supplier', supplierId, ...)`) | Compras (historial por proveedor) | EMPRESA | Sí (vía hook) | No — correcto (el historial es de OC por proveedor, no filtra por sucursal de destino) | OK |
| `useDashboard.ts:21-23` (`useCachedQuery('dashboard', undefined, ...)`) | Dashboard | **Sin decidir** (ver A5 pregunta abierta #2: ¿agregado de toda la empresa o de la sucursal activa?) | Sí (vía hook, aunque `fetchDashboardData` no lo usa para filtrar) | No — el dato no distingue por sucursal, consistente con "sin decidir": si la respuesta termina siendo SUCURSAL, esto pasa a ser un hallazgo real, no solo una pregunta abierta | OK hoy, condicionado a una decisión pendiente (no bloqueante — no hay fuga de datos entre empresas) |

**Nota sobre `getStockForBranch`:** tiene 3 call-sites (`ComprasPage.tsx:191`, `StockAdjustmentModal.tsx:32`, `OrderProductsSection.tsx:62`) pero ninguno pasa por `useCachedQuery`/`usePagedQuery` — son `await` directos, sin query key ni cache de por medio (llamadas puntuales durante un submit/escaneo). No aplica a esta tabla porque no hay ningún cache que pudiera aislar mal; los 3 call-sites ya reciben `empresaId` y `branchId` explícitos como parámetros de la función.

## Persistencia (localStorage/sessionStorage)

Grep exhaustivo (`localStorage.`/`sessionStorage.`) sobre todo `src/`: **5 resultados, 2 archivos, ningún dato de negocio.**

| Clave | Archivo:línea | Contenido | ¿Sobrevive a cambio de sucursal? | ¿Sobrevive a cambio de empresa? | ¿Sobrevive a logout? |
|---|---|---|---|---|---|
| `app-theme` | `Header.tsx:57,62,74` | Preferencia visual (claro/oscuro) | Sí — correcto, es preferencia de UI pura, no dato de negocio | Sí — correcto | No aplica todavía (ver nota abajo) |
| `sdgpd.activeBranchId` | `useSessionStore.ts:24,54,99` | Última sucursal elegida | Se actualiza al cambiar (no es un problema de fuga: es la sucursal actual, no la anterior) | **Sin verificar en los hechos** — no existe ningún trigger de UI que cambie de empresa (una sola empresa en el mock, `session.mock.ts`), así que este caso nunca se ejerció. Si se agrega, `resolveInitialBranchId` (línea 53-60) revalida contra `session.branches` de la empresa recién cargada — un `branchId` de la empresa anterior que no exista en la nueva cae a `session.defaultBranchId`, no se usa tal cual. No es una fuga de datos (no hay ningún dato de negocio en la clave, solo un id de sucursal), pero si la empresa nueva tuviera por coincidencia una sucursal con el mismo id, se seleccionaría sin que el usuario la haya elegido en esa empresa — riesgo de UX, no de aislamiento de datos (ver DECISIONES_TECNICAS.md: "conveniencia de UX, no autorización") | No existe flujo de logout en el proyecto (confirmado: 0 resultados de `logout`/`signOut` en todo `src/`) — no hay nada que verificar todavía |

**Ningún dato de negocio (catálogo, listado, cifra, objeto de dominio) se persiste en `localStorage`/`sessionStorage`** — confirmado de nuevo, mismo resultado que AUDIT_6 (Fase A).

## Mecanismo de limpieza al cambiar de sucursal

Confirmado en `useSessionStore.ts:98-102`: `setActiveBranch` actualiza el estado, persiste la elección, y llama a `resetAllStores()` (`resettableStores.ts:33-35`), que a su vez dispara `queryClient.invalidateQueries()` sin filtro (registrado en `queryClient.ts:82-84`). Efecto combinado:

1. Los 5 listados de alcance SUCURSAL cambian su propia query key al cambiar `branchId` (tabla arriba) — la query vieja queda con su dato bajo su propia key, nunca se pisa ni se muestra bajo la sucursal nueva.
2. El resto (empresa) no cambia de key, pero `invalidateQueries()` sin filtro los marca stale y dispara un refetch de los que tienen observador activo — por disciplina, no porque lo necesiten para aislamiento de sucursal.

No existe todavía un mecanismo equivalente para cambio de EMPRESA (no hay ninguna acción `setActiveCompany` en el store — ver pregunta abierta A5 #4, `session.mock.ts` tiene una sola `Company`). Es una laguna real pero no bloqueante: no hay ningún trigger de UI que pueda producir el escenario hoy.

## Veredicto final

**Ninguna query key de datos de negocio carece de `companyId`.** Los 24 puntos de entrada al cache confirmados por grep pasan, sin excepción, por `usePagedQuery`/`useCachedQuery`, que hacen estructuralmente imposible omitirlo (no es una convención que un desarrollador pueda olvidar — TypeScript + el diseño del hook lo impiden). Los 5 dominios de alcance SUCURSAL incluyen `branchId` en sus filtros. **No hay ningún hallazgo BLOQUEANTE. La corrida continúa a Fase 0.2.**

Diferencias con AUDIT_5 (Fase A): ninguna en la conclusión. Esta reverificación agrega la tabla exhaustiva línea-por-línea de los 24 call-sites (AUDIT_5 documentaba el mecanismo y citaba ejemplos representativos, no los 24 uno por uno) y confirma que no se agregó ningún consumidor nuevo desde esa auditoría (mismo commit `cef6e15` + solo los 15 archivos de documentación de esta sesión).
