# 00 — Resumen de la auditoría de backend (solo lectura)

**Fecha:** 2026-10-07. **Rama:** `sesion-auditoria-backend-2026-10-07`, desde `lean` = `origin/lean` = `159517e`. **Tag previo:** `pre-sesion-auditoria-backend-2026-10-07`.
**Alcance:** `FrontEnd/src` completo, `FrontEnd/docs/{adr,ESTADO.md,PENDIENTES.md,ARQUITECTURA.md}` y los 3 extractos legibles de `Documentacion/negocio/`. **No se tocó código.** No se decidió nada: la regla 2.9 no aplica en esta sesión.
**Stack objetivo** (se formaliza después en ADRs): Node + TypeScript + NestJS + PostgreSQL, multi-tenant con `empresa_id` y RLS.

Este archivo alcanza solo para arrancar la fase de ADRs. El detalle con evidencia está en:

| Archivo | Qué tiene |
|---|---|
| `01_ENDPOINTS.md` | las 91 llamadas, una por fila, más 11 inconsistencias de contrato (C-1..C-11) y lo que no pasa por `httpClient` |
| `02_MODELO_DE_DATOS.md` | 25 entidades, FKs explícitas e implícitas, estados, dinero, fechas, y el grafo de dependencias |
| `03_REGLAS_DE_NEGOCIO.md` | 72 reglas del mock, las que viven solo en la UI y los pasos no transaccionales |
| `04_TRANSVERSALES.md` | auth, tenancy, permisos, idempotencia, concurrencia, paginación, filtros, errores, dinero, export, uploads, polling, alertas, numeración, auditoría |
| `05_LO_QUE_EL_MOCK_NO_PUEDE_HEREDAR.md` | estado en memoria, atomicidad gratis, recorridos completos, relojes, snapshots, seeds |
| `06_COBERTURA_RF.md` | los 83 RF del Doc 04 contra el contrato |
| `07_CUMPLIMIENTO_PARCIAL.md` | qué modelo de entrega y recepción parcial hay, y qué pide cada documento (con citas) |
| `08_DECISIONES_ABIERTAS.md` | 26 decisiones con opciones y evidencia, sin elegir |

## Conteos

| Qué | Cantidad |
|---|---|
| Llamadas `httpClient.request` (= filas de 01) | **91**: 59 GET, 16 PUT, 15 POST, 1 DELETE |
| Mutaciones / con idempotencia / con concurrencia verificada | 32 / 15 / **1** |
| Listados paginados: offset / cursor / exports / listas sin paginar | 19 / 1 / 15 / 13 |
| Respuestas con DTO / con tipo de dominio / sin tipo | 28 / 59 / 4 |
| Funciones de "servidor" fuera de `httpClient` | 5 subsistemas (sesión, export, uploads, analítica, replenishment) + 11 funciones de services que acceden a stores sin request |
| Entidades inventariadas (02) | **25** (más 4 archivos de tipos excluidos con motivo y 24 tipos auxiliares nombrados) |
| Archivos de mock | 17 (todos en 02) |
| Reglas de negocio del mock (03) | **72** (66 puntos de rechazo explícitos en el código) |
| Reglas que viven solo en la UI | 13 |
| Operaciones que deberían ser una transacción y hoy son pasos sueltos | 7, más 2 efectos que directamente no existen (stock, cuenta corriente) |
| RF del Doc 04 | **83**: 2 completos, 37 parciales, **44 sin contrato** (de los 61 RF de etapa MVP, 29 sin contrato) |
| Decisiones abiertas | **26** (9 BLOQUEANTES) |

## Hallazgos por severidad

**8 BLOQUEANTE · 21 ALTO · 20 MEDIO · 5 BAJO.** Un hallazgo por línea; el archivo de detalle va entre paréntesis.

### BLOQUEANTE (impiden diseñar el esquema o el contrato)

- **B1** La decisión D1 (`DECISIONES_TECNICAS_LOG.md:219-220`) prohíbe mandar `empresaId` desde el front (IDOR), y **87 de 91 llamadas lo mandan** (regla 3.5). No se puede diseñar RLS ni las firmas sin resolverlo (04 §2, 08#1).
- **B2** No hay autenticación, la sesión es un mock sin rol (`session.service.ts:17`), `httpClient` no manda credenciales (`httpClient.ts:177-182`), y 8 mutaciones toman el actor del body (04 §1, 01 C-11).
- **B3** La exportación de ADR-004 **no tiene contrato HTTP**. El job corre en el navegador (`exportJobs.ts:82-131`) y las columnas son funciones del cliente (01 C-1).
- **B4** No hay forma de wire acordada: 59 de 91 respuestas devuelven el tipo de dominio del frontend, y conviven 2 envoltorios de página (01 C-4/C-5).
- **B5** El modelo de cumplimiento parcial es contradictorio: ADR-001 y Doc 03 §17.25 (pendiente en el mismo pedido) contra Doc 04 RF-PED-002/RF-PRE-003 (sub-pedido, MVP) (07).
- **B6** Dos mecanismos de rechazo de negocio (15 `throw ApiError` con texto contra uniones de `reason` con 2xx), y en modo `http` **el cuerpo de error se descarta** (`httpClient.ts:188-190`) (04 §8).
- **B7** **Ninguna operación mueve stock** (03, R-INV-1). No hay reserva, descuento al despachar, ingreso por recepción ni reingreso por rechazo, así que no existe un modelo de inventario que heredar (08#10).
- **B8** Los ids se generan con `Date.now()` en el cliente o el mock, y ADR-006 los valida **por prefijo** (`ids.types.ts:61-72`). Hay que decidir el formato de id antes de cualquier tabla (05 §4, 08#3).

### ALTO (el backend heredaría un bug o un hueco de integridad o aislamiento)

- **A1** 4 funciones de negocio **sin `empresaId`**: `fetchKpis`, `fetchSalesSeries`, `fetchTopProducts` y `fetchRecentOrders` (`services/mock/dashboard.service.ts:39-68`). Son código muerto, sin consumidores. Se registra por la condición de parada y no se corrige.
- **A2** `httpClient` reintenta POST y PUT ante timeout o 5xx (`httpClient.ts:250`), y 17 mutaciones no tienen idempotencia: un `POST /orders` lento **duplica el pedido** (04 §4).
- **A3** `createOrder` persiste `subtotal`, `tax` y `total` enviados por el cliente, sin recalcular. El IVA se calcula en float solo en la UI (03, R-PED-4).
- **A4** Sobreentrega posible: `applyDeliveryToOrderLines` suma sin tope (`orders.service.ts:541-561`), `registrarEntrega` no valida cantidades ni pertenencia de línea, y `derivePendingQuantity` lo oculta con `Math.max(0, …)` (03, R-PED-6/R-ENT-7).
- **A5** Dos caminos a `FINALIZADO` con efectos distintos: el POD finaliza sin remito ni actualización del pedido (`trips.service.ts:558-560`) (03, R-VIA-11).
- **A6** `requiereEvidencia` del motivo solo lo valida la UI (`RegistrarEntregaModal.tsx:149`) (03, R-ENT-8).
- **A7** `assignDeliveriesToStop` no valida el estado de la entrega, la sucursal ni el estado del viaje (03, R-VIA-6).
- **A8** La fusión de OC desde una sugerencia no compara moneda y pisa `unitPrice` (`purchaseOrders.service.ts:364-380`) (03, R-CMP-7).
- **A9** Recibir una OC solo cambia el estado: sin cantidades recibidas y sin stock (03, R-CMP-6).
- **A10** Los remitos **no tienen endpoint**: `DeliveryHistoryModal.tsx` lee el store en memoria con `getDeliveryNotesForDelivery` (`deliveries.service.ts:652`) (01).
- **A11** `registrarEntrega`, `markStopNoVisitada`, `registerPod` y `reprogramDelivery` son pasos sueltos que pueden dejar estados inconsistentes (03, última sección).
- **A12** Los 8 toasts que muestran `err.message` cambiarían de texto al pasar a modo `http` (04 §8).
- **A13** Solo `assignDeliveriesToStop` chequea versión. Las ediciones de cliente, producto, proveedor y OC, y `transitionTrip`/`updateStopOrder`, pisan sin aviso (04 §5).
- **A14** El almacén de idempotencia es un `Map` global, sin alcance por empresa ni endpoint y sin TTL (`idempotency.ts:24`). En 6 lugares la clave se genera **al enviar**, contra la corrección de ADR-010 §4 (04 §4).
- **A15** Las alertas tienen `leida` **global** (ADR-007 pide por usuario) y nada las genera. La auditoría **no la escribe ninguna mutación** (04 §13, §15).
- **A16** El dinero es float en todas las entidades. ADR-008 está decidido pero no implementado; ya era ALTO en `ESTADO.md` (04 §9).
- **A17** La matriz de permisos no la consulta nadie, y hay un rol fijo `USER_ROLE='ADMIN'` (`InventoryPage.tsx:69`) (04 §3).
- **A18** **`BackEnd/` está en `.gitignore`** (`.gitignore:9-10`), y la regla es **más amplia de lo que parece**: sin barra inicial, se aplica a cualquier carpeta con ese nombre **en cualquier nivel**. Como esta máquina tiene `core.ignorecase=true`, también atrapa `backend/` en minúscula, **incluida la carpeta de estos entregables**. Evidencia: `git check-ignore -v FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md` → `.gitignore:10:BackEnd/`. En un CI Linux (case-sensitive) no la ignoraría, así que el comportamiento depende de la máquina. Lo que se escriba en `BackEnd/` no se versiona y no da aviso (08#26). **No se corrigió** (consigna). Los entregables se agregaron con `git add -f` (ver V5).
- **A19** El estado "reposición solicitada" vive solo en el navegador (`useReplenishmentStore.ts:29-49`) (02).
- **A20** `analytics` lee su mock directo, sin contrato (`AnalyticsPage.tsx:2`). Ya era ALTO en `ESTADO.md`.
- **A21** Ninguna operación escribe la cuenta corriente del cliente: no hay vínculo pedido o remito → deuda, y los saldos están persistidos como derivados que nunca se recalculan (02, 08#17).

### MEDIO

- **M1** El orden no viaja en 17 exports y listados (01 C-3).
- **M2** `exportSuppliers` recorta en el cliente (01 C-2).
- **M3** 13 listas sin paginar ni límite, y ningún resolver acota `pageSize` (01 C-6, 04 §6).
- **M4** Verbos en el path, mezcla de idiomas, 4 convenciones de transición distintas (01 C-7).
- **M5** `branchId` en el path, en la query o en ningún lado (01 C-8).
- **M6** `GET /suppliers` con dos contratos distintos (01 C-9).
- **M7** `createTrip` no valida chofer ni vehículo activo, ni disponibilidad (03, R-VIA-1).
- **M8** `transitionTrip` no tiene efectos sobre las entregas ni historial (03, R-VIA-8).
- **M9** `advanceOrderStatus` ignora las entregas; `advance` y `cancel` no escriben `history` (03, R-PED-7/10).
- **M10** El CUIT del cliente no es único ni se valida; la licencia del chofer no es única (03).
- **M11** Dos modelos de usuario desconectados, y `Driver` sin usuario (02).
- **M12** A `PermissionMatrix` le faltan `compras` y `settings` (02).
- **M13** Caja: movimiento sin fecha (`time` solamente), sin filtros, `category` sin coherencia con `type` (03, R-CAJ-2).
- **M14** Seeds con fechas relativas a hoy y formatos no ISO (`'Hace 5 min'`, `dd/MM/yyyy`) (05 §4, §6).
- **M15** FKs implícitas por nombre o SKU en 9 tipos; el SKU es editable (02, 08#19).
- **M16** Dos fuentes para el tablero (`dashboard.service.ts` y `dashboardAggregates.service.ts`) (01).
- **M17** Requests anidados dentro de los resolvers del mock (05 §9).
- **M18** SKUs y nombres huérfanos en analytics, alertas y proveedores (`PENDIENTES.md` #20).
- **M19** `createPurchaseOrder` no verifica que el proveedor exista (03, R-CMP-1).
- **M20** El cursor de alertas no acota `pageSize` (V6c, `VERIFICACION_CORRIDA_COMPLETA.md`).

### BAJO

- **L1** `PENDING_VOUCHERS_MOCK` (`cash.data.ts`) sin consumidores.
- **L2** `TopProduct` definido dos veces con formas distintas (`dashboard.types.ts:24`, `analytics.types.ts:19`).
- **L3** Categorías de caja que mezclan inglés y español (`cash.types.ts:6-20`).
- **L4** Vocabulario de `reason` inconsistente (`not-found` y `order-not-found`).
- **L5** `RecentOrder.status` sin `'invoiced'` (`dashboard.types.ts:39`).

## Decisiones abiertas (detalle en `08_DECISIONES_ABIERTAS.md`)

| # | Pregunta | Bloq. |
|---|---|---|
| 1 | ¿De dónde sale el tenant: sesión o parámetro? (D1 contra la regla 3.5) | **sí** |
| 2 | Autenticación, contenido de la sesión, usuario unificado, chofer como usuario | **sí** |
| 3 | Formato de id que genera el servidor (prefijo ADR-006 contra UUID) | **sí** |
| 4 | Forma del wire: DTO para todo, casing, envoltorio de página | **sí** |
| 5 | Exportación: columnas en servidor o cliente, job contra síncrono | **sí** |
| 6 | Cumplimiento parcial de venta: pendiente por línea contra sub-pedido | **sí** |
| 7 | ¿Se modela Preparación → Despacho entre Pedido y Entrega? | **sí** |
| 8 | Recepción parcial de compras | |
| 9 | Relación pedido ↔ sucursal (vía Delivery contra `Order.branchId`) | |
| 10 | Cuándo y cómo se mueve el stock; kardex como ledger | **sí** (inventario) |
| 11 | Dinero en el wire y en la base (ADR-008 sin implementar), moneda del pedido, IVA | |
| 12 | Rechazos de negocio: 2xx + `reason` contra 4xx con body | **sí** (contrato) |
| 13 | Idempotencia: header o body, alcance, TTL, cobertura | |
| 14 | Concurrencia optimista: qué entidades, `version` o `ETag` | |
| 15 | Paginación: offset o cursor | |
| 16 | Estado del pedido: qué se persiste; "Rechazado", "Entregado bloqueado" | |
| 17 | Cuenta corriente: ledger propio o derivado | |
| 18 | Alcance empresa/sucursal de compras, caja, vehículos, lotes | |
| 19 | Relación por SKU contra `productId` | |
| 20 | Auditoría: genérica, por entidad, o ambas | |
| 21 | Alertas: generación y leído por usuario | |
| 22 | Frontera transaccional de los efectos cruzados | |
| 23 | Dos tableros y la analítica | |
| 24 | Snapshot del cliente en el pedido; dirección de entrega | |
| 25 | Numeración de remito, OC, recibo, factura y viaje | |
| 26 | Dónde vive el backend (`BackEnd/` ignorado) | |

## Orden sugerido de tandas de backend

Sale del grafo de dependencias (02, al final) y de qué decisiones destraba cada tanda. Es una propuesta de orden: las decisiones siguen abiertas.

| Tanda | Contenido | Necesita decidido |
|---|---|---|
| **BE-0** | Ubicación del repo, esqueleto, contrato transversal: auth, tenancy + RLS, errores, ids, wire, paginación, idempotencia, concurrencia, base de auditoría | #1, #2, #3, #4, #12, #13, #14, #15, #20, #26 |
| **BE-1** | Organización e IAM: empresa, sucursales (¿depósitos?), usuario unificado, roles y permisos con enforcement | #2, #18 |
| **BE-2** | Maestros sin dependencias de negocio: proveedores, motivos, vehículos, choferes | #18 |
| **BE-3** | Productos + búsqueda acotada (ADR-016) + clientes | #19, #24 |
| **BE-4** | Inventario: stock por sucursal, lotes, kardex | #10, #18 |
| **BE-5** | Pedidos (+ reserva) | #6, #9, #11, #16 |
| **BE-6** | Entregas y remitos (+ preparación, si se adopta) | #6, #7, #22 |
| **BE-7** | Viajes, paradas, POD, GPS, uploads (ADR-005) | #22 |
| **BE-8** | Compras y recepción | #8, #10 |
| **BE-9** | Caja, cuenta corriente, facturación | #11, #17, #25 |
| **BE-10** | Alertas, tablero, analítica, exportación (ADR-004) | #5, #21, #23 |

## Verificaciones (obligatorias, no delegadas: salida real pegada)

### V1 — Filas de 01 = llamadas reales a `httpClient.request`

```
$ grep -rnE "httpClient\.request" src | grep -vE ":[0-9]+:\s*(//|\*)" | wc -l
88
$ grep -rnE -B1 "^\s*\.request<" src | grep -cE "httpClient\s*$"
3
$ grep -cE "^\| [0-9]+ \| (GET|POST|PUT|PATCH|DELETE) \|" docs/historial/auditorias/backend/01_ENDPOINTS.md
91
```
(desde `FrontEnd/`). **88 + 3 = 91 = 91 filas. PASA.**

El primer conteo, con un grep de una sola línea, daba 88. Las 3 llamadas faltantes están escritas en dos líneas (`return httpClient` / `.request<…>`): `purchase-suggestions.service.ts:89`, `subscription.service.ts:89` y `users-roles.service.ts:95`. Las 2 menciones en comentarios (`httpClient.ts:11`, `types.ts:26`) se excluyen.

### V2 — Toda entidad de `shared/types/` y todo archivo de `data/mock/` está en 02 o excluido con motivo

```
$ for f in src/shared/types/*.ts src/data/mock/*.ts; do grep -q "$(basename $f)" 02_MODELO_DE_DATOS.md || echo FALTA; done
archivos: 39, faltan: 0
$ (cada `export interface` de los 18 archivos de tipos no excluidos, buscado por nombre en 02)
interfaces exportadas: 76, sin nombrar: 0
```
**PASA.** La primera corrida del chequeo por interface dio 24 sin nombrar: subestructuras descritas en prosa (`ClientInvoiceTransaction`, `PodReceptor`…) y tipos de contrato (`CreatePurchaseOrderInput`…). Se agregó a 02 la tabla "Tipos auxiliares" que nombra cada uno y dice dónde está cubierto. 4 archivos excluidos con motivo: `ids.types.ts`, `pagination.types.ts`, `deliveryStatus.types.ts` y `tripStatus.types.ts`.

### V3 — 15 referencias archivo:línea al azar

Muestreo con semilla fija (`random.seed(20261007)`) sobre 304 referencias candidatas del texto de 01-08, sin la tabla generada de 01 (esa la cubre V1). Script: `scratchpad/v3_sample.py`, fuera del repo.

| # | Doc:línea | Referencia | Lo que el doc afirma | Línea real | ¿Coincide? |
|---|---|---|---|---|---|
| 1 | 03:121 | `alerts.service.ts:75-84` | `leida = true` global | `:80` `alertsStore.map((a) => (a.id === alertId ? { ...a, leida: true } : a))` | sí |
| 2 | 04:110 | `vehicles.service.ts:20-26` | filtros `search`, `soloActivos` | `:20-23` `VehiclesQueryFilters { empresaId; search?; soloActivos? }` | sí |
| 3 | 01:201 | `dashboard.types.ts:8` | `value: string` ya formateado | `:8` `value: string;` | sí |
| 4 | 04:47 | `InventoryPage.tsx:69` | rol fijo `USER_ROLE` | `:69` `const USER_ROLE: 'ADMIN' \| 'EMPLOYEE' = 'ADMIN';` | sí |
| 5 | 07:40 | `orders.service.ts:383-388` | `delivered → invoiced` en `ORDER_STATUS_FLOW` | `:383` `const ORDER_STATUS_FLOW…`, `:387` `delivered: 'invoiced'` | sí |
| 6 | 02:45 | `logistics.types.ts:82` | `zone: 'Norte'\|'Centro'\|'Sur'` | `:82` `zone: 'Norte' \| 'Centro' \| 'Sur';` | sí |
| 7 | 04:31 | `deliveries.service.ts:653` | `void empresaId` | `:653` `void empresaId;` | sí |
| 8 | 02:112 | `inventory.types.ts:89` | `InventoryMovement` | `:89` `export interface InventoryMovement {` | sí |
| 9 | 05:82 | `order.types.ts:58-59` | `sku` + `name` sin `productId` | `:58` `sku: string;` `:59` `name: string;` | sí |
| 10 | 07:34 | `purchaseOrder.types.ts:30-35` | línea de OC sin cantidad recibida | `:30-33` `PurchaseOrderLine { id; productId; quantity; …` | sí |
| 11 | 02:57 | `order.types.ts:66` | `Order` | `:66` `export interface Order {` | sí |
| 12 | 05:48 | `purchase-suggestions.service.ts:19-21` | `fetchProducts` server→server | `:20` `const products = await fetchProducts(empresaId);` | sí |
| 13 | 01:10 | `purchase-suggestions.service.ts:89` | llamada partida en dos líneas | `:89` `.request<ExportResult<PurchaseSuggestionDTO>>({` | sí |
| 14 | 02:225 | `inventory.types.ts:124` | `InventoryData` | `:124` `export interface InventoryData {` | sí |
| 15 | 02:92 | `useReplenishmentStore.ts:29-49` | estado "solicitado" solo en el navegador | `:29` `statusByProductId: Record<…>`, `:41-42` `already-requested` | sí |

**15/15. PASA.** Además del muestreo, durante la redacción se reverificaron a mano unas 25 referencias y se corrigieron **12 errores propios** antes de cerrar:
- 03: 64 → 72 reglas, `:318` → `:322`, `:296-370` → `:295-376`, `~:480-490` → `:490`, 18 → 21 usos de `Date.now()`.
- 04: 12 → 15 `ApiError`, y 4 rangos de línea de `httpClient.ts` corridos.
- 01: 17 → 15 exports, 18 → 17 en C-3.

### V4 — Los 83 RF están en 06

```
$ grep -cE '^\| RF-' 06_COBERTURA_RF.md                → 83
$ grep -oE '^\| RF-[A-Z]+-[0-9]+' … | sort -u | wc -l  → 83
$ diff <(RF de Documento-04, encabezados "### RF-") <(RF de 06)   → sin diferencias: "mismos 83 RF que el Doc 04"
completo: 2   parcial: 37   sin contrato: 44
MVP: total 61 / sin contrato 29 · Crecimiento: 18 / 11 · Enterprise: 4 / 4
```
**PASA.**

### V5 — Cambios solo en `FrontEnd/docs/`

**Primera corrida:** `git status --porcelain --untracked-files=all` salió **vacío**, con los 9 archivos en disco. Causa: `git check-ignore -v FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md` → `.gitignore:10:BackEnd/` (ver A18). Se agregaron con `git add -f` **sin tocar `.gitignore`**: un archivo fuera de `FrontEnd/docs/` está prohibido, y es justamente el hallazgo.

**Segunda corrida** (después de `git add -f FrontEnd/docs/historial/auditorias/backend/`):

```
$ git status --porcelain --untracked-files=all
A  FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md
A  FrontEnd/docs/historial/auditorias/backend/01_ENDPOINTS.md
A  FrontEnd/docs/historial/auditorias/backend/02_MODELO_DE_DATOS.md
A  FrontEnd/docs/historial/auditorias/backend/03_REGLAS_DE_NEGOCIO.md
A  FrontEnd/docs/historial/auditorias/backend/04_TRANSVERSALES.md
A  FrontEnd/docs/historial/auditorias/backend/05_LO_QUE_EL_MOCK_NO_PUEDE_HEREDAR.md
A  FrontEnd/docs/historial/auditorias/backend/06_COBERTURA_RF.md
A  FrontEnd/docs/historial/auditorias/backend/07_CUMPLIMIENTO_PARCIAL.md
A  FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md
$ git diff --stat
(vacío: no hay cambios sin stagear en archivos trackeados)
$ git diff --cached --stat
 9 files changed, 1645 insertions(+)        (los 9 de arriba, solo inserciones)
archivos fuera de FrontEnd/docs/: 0
```

**PASA.** El segundo commit de la sesión modifica solo `FrontEnd/docs/ESTADO.md`, también dentro de `FrontEnd/docs/`. El chequeo final sobre el rango completo (`git diff --stat pre-sesion-auditoria-backend-2026-10-07..HEAD`) está en el informe del chat.

## Qué NO se pudo verificar

- **Comportamiento real en modo `http`:** nunca se corrió `VITE_API_MODE=http` (no hay servidor). Las conclusiones sobre `runHttp` (body de error descartado, sin credenciales, reintentos de POST) salen de **leer** `httpClient.ts`, no de ejecutarlo.
- **Los `.docx`/`.pdf` de `Documentacion/negocio/`:** fuera de alcance por consigna. Solo se leyeron `Documento-04-*.md`, `doc02_all_extracted.txt` y `doc03_extracted.txt`. Si los extractos difieren de los originales (por ejemplo, tablas perdidas en la extracción), las citas de 07 heredan esa diferencia.
- **Columna "Consumidor UI" de 01:** se generó buscando el nombre de la función en líneas de código de `.tsx` y hooks. Un consumidor que la recibe por parámetro con otro nombre (por ejemplo `fetchRows={…}`) puede no aparecer, y una coincidencia por nombre en otro contexto puede sobrar. Se revisaron a mano solo los "sin consumidor".
- **Columna "Concurr.":** marca solo a quien **compara** `expectedVersion`. No se auditó si existen otros mecanismos implícitos.
- **Las 72 reglas de 03:** se relevaron desde los puntos de rechazo y la lectura de las mutaciones. Una regla escrita como filtro silencioso dentro de un listado (por ejemplo, `filterAndSortLowStock` excluyendo inactivos) puede tener hermanas no listadas en otros listados.
- **Cobertura RF (06):** "completo" y "parcial" son un juicio sobre el **contrato** contra el texto del RF, no sobre si la UI cumple los criterios de aceptación.
