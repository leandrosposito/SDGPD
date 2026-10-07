# 08 — Decisiones abiertas antes de escribir backend

**Verificado el 2026-10-07.** Lista numerada **sin elegir**. Por cada una: la pregunta, las opciones, la evidencia del repo **a favor** y **en contra** de cada opción, y qué ADRs condiciona. Las marcadas **[BLOQUEANTE]** impiden diseñar el esquema o el contrato hasta resolverlas. El orden sigue la dependencia: las primeras condicionan a las siguientes.

---

### 1. [BLOQUEANTE] ¿De dónde sale la empresa (tenant) en cada request?

- **A. El servidor la deriva de la sesión y el frontend deja de mandar `empresaId`.**
  - A favor: decisión D1 (`DECISIONES_TECNICAS_LOG.md:219-220`, "candidato a IDOR"); `session.types.ts:3-5`. Con RLS, el tenant se fija por conexión a partir del token.
  - En contra: hay que cambiar la firma de ~87 funciones y todas las query keys (regla 3.4 del protocolo: "Toda query key incluye `companyId`"). Esa regla sigue siendo útil para el caché aunque el valor no viaje.
- **B. Se manda en el request y el servidor valida que coincida con la sesión.**
  - A favor: es el estado actual (87 de 91 llamadas, 04 §2), la regla 3.5 y `shared/api/types.ts:13-21`.
  - En contra: D1 lo describe como el riesgo. Duplica la fuente de verdad, y cada endpoint necesita el chequeo (si uno lo olvida, hay fuga entre tenants).
- **C. Va en el path (`/empresas/{id}/…`)** y se valida contra la sesión. Mismas ventajas y desventajas que B, con la URL más explícita.
- **Condiciona:** D1/D2/D4 del log, la regla 3.5, el diseño de RLS y todas las firmas de 01. Lo mismo aplica a `branchId` (nota de seguridad de D4, `:233`).

### 2. [BLOQUEANTE] Autenticación, sesión e identidad

- **Preguntas:**
  - ¿Cookie `HttpOnly` o bearer token?
  - ¿Qué devuelve la sesión: rol, permisos efectivos, sucursales habilitadas por usuario?
  - ¿`SessionUser` (`session.types.ts:29`) y `UserAccount` (`settings.types.ts:7`) se unifican en un solo usuario?
  - ¿`Driver` es un usuario con rol `Chofer` o una entidad aparte?
- **Evidencia:**
  - Hoy no hay auth (04 §1).
  - Dos modelos de usuario desconectados (02).
  - 8 mutaciones toman el actor del body (01 C-11).
  - `httpClient` no manda credenciales (`httpClient.ts:177-182`).
  - La app del chofer (POD, GPS, ADR-010/011) necesita un usuario chofer **autenticado**, lo que pesa a favor de la unificación. Pero `Driver` existe como ABM aparte desde la Tanda 10B (`driver.types.ts`).
- **Condiciona:** RF-IAM-*, ADR-010 §4 (idempotencia por usuario o dispositivo), ADR-007 (leído por usuario), auditoría (#20).

### 3. [BLOQUEANTE] Formato de los ids que genera el servidor

- **A. String con prefijo** (`ord-…`, `cli-…`, compatible con ADR-006).
  - A favor: los constructores validan **por prefijo** (`ids.types.ts:61-72`; `asOrderId('uuid')` tira `InvalidIdError`) y los seeds y scripts lo asumen.
  - En contra: un prefijo en la PK de Postgres es atípico. Se puede resolver con una PK interna más un id público prefijado.
- **B. UUID o bigint.**
  - A favor: nativo de la base y sin colisiones (hoy se usa `Date.now()`, 05 §4).
  - En contra: hay que cambiar los validadores de ADR-006, y "prefijo = tipo" deja de ser verificable en runtime.
- **Condiciona:** ADR-006, todos los mappers, los scripts `v*.mjs` y `MAX_*`.

### 4. [BLOQUEANTE] Forma del wire (el contrato real)

- **Preguntas:**
  - ¿Todos los recursos pasan a tener DTO? Hoy 28 de 91 respuestas tienen DTO y 59 devuelven el tipo de **dominio** (01 C-5).
  - ¿snake_case en español (`numero_pedido`, `estado_comercial`, los DTO actuales) o camelCase?
  - ¿Cuál es el envoltorio de página? Hoy hay dos: `{data, meta:{page_size}}` contra `PageResult {items, pageSize}` (01 C-4).
- **A favor de DTO para todo:** la capa `api/` ya está pensada así (`GUIA_MIGRACION_MODULO.md`), y aísla al servidor del modelo interno del frontend.
- **En contra:** hay que escribir DTO y mapper para logística, viajes, compras, vehículos, choferes, alertas y motivos, que hoy no los tienen.
- **Subpregunta:** los campos que **calcula el servidor** y viajan en la lectura (`allowedTransitions`, `capacidadUsada`, `sobrecargado`), ¿son parte del DTO? ADR-010 dice que sí para `allowedTransitions`.
- **Condiciona:** ADR-010 §1 (`allowedTransitions` en el contrato), ADR-011 §2, ADR-007.

### 5. [BLOQUEANTE] Exportación: ¿quién define las columnas y cómo se entrega el archivo?

- **Contexto:** ADR-004 decidió un job en el servidor (`POST …/export` → `202 {jobId}` → `GET /exports/{jobId}`). Hoy el job corre en el navegador y las columnas son funciones del cliente (01 C-1).
- **A. Columnas definidas en el servidor por recurso**, y el cliente manda solo filtros, orden y formato.
  - A favor: ADR-004 al pie de la letra, y la regla 3.3.
  - En contra: se pierde la flexibilidad actual (cada pantalla elige sus columnas, `ClientsPage.tsx:59-74`).
- **B. El cliente manda la lista de columnas por nombre**, a partir de una lista blanca por recurso.
  - A favor: conserva la elección por pantalla.
  - En contra: hay que mantener la lista blanca sincronizada.
- **C. Descarga síncrona.**
  - A favor: más simple.
  - En contra: ADR-004 la descartó explícitamente (alternativa 2).
- **Además:**
  - `exportSuppliers` recorta en el cliente (C-2).
  - El orden no viaja en 14 exports (C-3).
- **Condiciona:** ADR-004, ADR-011 §7 (los documentos impresos reusan el mismo patrón).

### 6. [BLOQUEANTE] Modelo de cumplimiento parcial de venta

- **A. Pendiente derivado por línea en el mismo pedido.**
  - A favor: ADR-001, Doc 03 §17.25 y §17.50 (pendiente configurable), §12.109 y §17.98 (backorder recién en la segunda etapa). Ya está implementado.
  - En contra: Doc 04 RF-PED-002 y RF-PRE-003 (MVP) piden partición.
- **B. Backorder como sub-pedido.**
  - A favor: RF-PED-002 y RF-PRE-003 al pie de la letra.
  - En contra: contradice ADR-001 y Doc 03, y rompe el conteo de pedidos de ADR-009.
- **Evidencia completa y efectos en el frontend:** `07_CUMPLIMIENTO_PARCIAL.md`.
- **Condiciona:** ADR-001, ADR-009, ADR-010 §1, ADR-014 (numeración del hijo).

### 7. [BLOQUEANTE] ¿Se modela Preparación → Despacho entre Pedido y Entrega?

- **Opciones:** sí, como entidades (Doc 02 §10.21, Doc 03 §17.24, RF-PRE-001..004 MVP); o no, y la preparación queda como un estado (hoy `preparing`).
- **En contra de modelarlo ahora:** RF-PRE no tiene ningún contrato (06), y ADR-010 ya fijó Viaje → Parada → Entrega → Línea.
- **A favor:** RF-PRE-003 (faltante en picking → ajuste de stock → backorder) no tiene dónde vivir sin una entidad de preparación.
- **Condiciona:** ADR-010 §2 (jerarquía), #6, #9.

### 8. Recepción de compras parcial

- **Opciones:**
  - A. `cantidadRecibida` por línea más un estado `partial` (RF-CMP-002, MVP).
  - B. Remito de compra como documento propio, simétrico a `DeliveryNote` (RF-CMP-002 habla de "parte de recepción (Remito de Compra)").
  - C. Partición de la OC (RF-CMP-002, tarea: "algoritmo de partición de OC").
- **Evidencia:** hoy no hay nada (`purchaseOrder.types.ts:21,30-35`; 03, R-CMP-6).
- **Condiciona:** #10 (stock) y la simetría con ADR-001.

### 9. Relación pedido ↔ sucursal

- **Opciones:**
  - A. Derivada vía `Delivery` (ADR-009, implementado).
  - B. `Order.branchId` (sucursal que vende o despacha).
- **A favor de A:** ADR-009 ya la aceptó con la distorsión documentada.
- **A favor de B:**
  - RF-INV-007: la reserva de stock al confirmar necesita saber **de qué sucursal** reservar, **antes** de que exista una `Delivery`.
  - Un pedido nuevo no aparece en ningún filtro por sucursal hasta que se despacha (ADR-009, punto 2).
- **Condiciona:** ADR-009, #10.

### 10. [BLOQUEANTE para inventario] ¿Cuándo y cómo se mueve el stock?

- **Contexto:** hoy nada mueve stock (03, R-INV-1).
- **Preguntas:**
  - ¿Reserva al confirmar (RF-INV-007)?
  - ¿Baja física al despachar (RF-INV-007) o al entregar?
  - Si se descuenta al despachar, el rechazo en la entrega tiene que reingresar. ¿Ese reingreso es automático (RF-ENT-002: "debe reingresarse al stock físico") o pasa por la confirmación manual de "en retorno" (ADR-010 §6, opción A aprobada)?
  - ¿Un ajuste manual requiere documento con motivo (RF-INV-002)?
  - ¿El kardex es el ledger (fuente de verdad) y el saldo se deriva, o el saldo se materializa y el kardex es auditoría?
- **Evidencia en contra de derivar el saldo:** `ProductStock.stock` existe como campo y los lotes no se concilian con él (02).
- **Condiciona:** ADR-010 §6, `PENDIENTES.md` #9 (lotes por sucursal), #6, #8, #9.

### 11. Representación del dinero en el wire y en la base

- **Contexto:** ADR-008 está **decidido** (centavos enteros más moneda), pero no está implementado: el wire actual usa floats en todos lados (02, 04 §9).
- **Preguntas:**
  - ¿El backend nace con centavos y el frontend migra en paralelo, o se mantiene el float hasta una tanda de migración?
  - ¿`Order` tiene moneda? (hoy no)
  - ¿Quién calcula el IVA y con qué redondeo? (hoy, la UI en float, R-PED-4)
- **Condiciona:** ADR-008, todos los DTO con importes.

### 12. [BLOQUEANTE para el contrato] Cómo se devuelven los rechazos de negocio

- **A. `200` con `{success: false, reason}`** (el mecanismo de la mayoría de los services).
  - A favor: `runHttp` solo lee el body si `response.ok` (`httpClient.ts:188-195`), así que funciona sin tocar el cliente.
  - En contra: un estado de error con `200` es atípico para proxies, logs y monitoreo.
- **B. `4xx` (`409`/`422`) con body `{reason, detail}`**, y `httpClient` pasa a parsear el body de error.
  - A favor: semántica HTTP. ADR-011 §3 ya habla de "409 granular".
  - En contra: hay que cambiar `runHttp` y unificar los dos mecanismos actuales (15 `throw ApiError` con texto contra uniones de `reason`, 04 §8).
- **En cualquiera de los dos:** los 8 toasts que muestran `err.message` cambian de comportamiento en modo `http` (04 §8).
- **Condiciona:** ADR-015 (que eligió `reason` para `createOrder`), ADR-011 §3.

### 13. Idempotencia: transporte, alcance y cobertura

- **Preguntas:**
  - ¿Header `Idempotency-Key` o campo del body (hoy, el body)?
  - ¿Alcance (empresa + usuario + endpoint + clave) y TTL (ADR-010 §4 sugiere 24-48 h)?
  - ¿Qué responde ante la misma clave con otro payload?
  - ¿Se extiende a las 17 mutaciones que hoy no la tienen?
- **Evidencia:** `httpClient` reintenta POST y PUT ante timeout (`httpClient.ts:250`), lo que duplica pedidos, movimientos de caja y OC. Eso pesa a favor de extenderla o de no reintentar mutaciones sin clave.
- **Condiciona:** ADR-010 §4.

### 14. Concurrencia optimista: ¿qué entidades y con qué mecanismo?

- **Opciones:** `version` en el body (hoy, solo `Trip`, y la chequea solo `assignDeliveriesToStop`) o `ETag`/`If-Match`.
- **Evidencia:** las ediciones de cliente, producto, proveedor y OC pisan el último cambio sin aviso (04 §5), y `transitionTrip`/`updateStopOrder` no chequean.
- **Condiciona:** ADR-011 §3.

### 15. Paginación: offset o cursor

- **Contexto:** `PROTOCOLO.md` §3.1 dice "cursor por defecto", pero 19 de 20 listados usan offset (04 §6). ADR-007 eligió cursor para alertas y llamó al offset "lastre histórico".
- **Opciones:**
  - A. Migrar a cursor los listados de alto volumen (movimientos, entregas, pedidos).
  - B. Aceptar offset con `pageSize` máximo y `total`.
- **Ojo:** los aggregates (`total`, KPIs) viajan en la misma respuesta. Con cursor, `total` cuesta un `COUNT` aparte.
- **Condiciona:** la regla 3.1, ADR-007.

### 16. Estado del pedido: ¿qué se persiste?

- **Contexto:** conviven `status` (legado, "deprecado") y `comercial`, y ADR-010 §1 define 3 ejes (comercial persistido; logístico y financiero derivados).
- **Preguntas:**
  - ¿Desaparece `advanceOrderStatus` (avance manual del `status` legado, sin mirar entregas, 03 R-PED-7)?
  - ¿Dónde vive "Rechazado" (RF-ENT-002) y "Entregado y bloqueado" (RF-ENT-001)?
- **Condiciona:** ADR-010 §1, ADR-002.

### 17. Cuenta corriente: ¿ledger propio o derivado?

- **Contexto:** hoy `ClientAccount.transactions` está embebido, nadie lo escribe, y persiste derivados (`currentBalance`, `status`, `daysOverdue`, `balance` por transacción).
- **Preguntas:**
  - ¿Qué documento genera el débito: la factura (RF-FAC-001, "Toma un Pedido o Remito") o el remito?
  - ¿La aplicación de pagos (FIFO, `clients.service.ts`) se persiste (RF-CCT-002) o se sigue calculando?
- **Condiciona:** #6, #11.

### 18. Alcance de las entidades dudosas

- **Compras:** el protocolo dice EMPRESA, pero la OC tiene `branchId` de destino, y el filtro es opcional en el listado (`purchaseOrder.types.ts:81`).
- **Caja:** EMPRESA según el protocolo, pero una caja física es de una sucursal (RF-TES-002). Hoy no tiene sucursal ni fecha.
- **Vehículos y choferes:** EMPRESA (decisión de la Tanda 10B, sin ADR).
- **Lotes:** por producto (empresa) contra por sucursal (`PENDIENTES.md` #9).
- **Condiciona:** las políticas de RLS por sucursal y la regla 3.4.

### 19. Relación por SKU contra `productId`

- **Contexto:** `OrderItem`, `InventoryMovement`, `ProductHistoryEvent` y `SupplierProduct` referencian por **SKU**, y el SKU es editable (`updateProduct:126`).
- **Opciones:**
  - A. Agregar `productId` y conservar el SKU como snapshot.
  - B. Hacer el SKU inmutable.
- **Condiciona:** ADR-016 (validación por id contra por SKU), Tanda 21 (`product-not-found` busca por SKU).

### 20. Auditoría: ¿tabla genérica, historiales por entidad, o ambos?

- **Contexto:** existen historiales parciales (`Order.history`, `Delivery.historial`, `Trip.overrides`), y el log genérico (`AuditLogItem`) no lo escribe nadie (04 §15).
- **Preguntas:** ¿qué mutaciones se auditan, con antes y después? ¿Retención? (RF-AUD-001/002)
- **Condiciona:** #2 (actor de la sesión).

### 21. Alertas: generación y lectura por usuario

- **Contexto:** nada genera alertas, y `leida` es global (04 §13).
- **Preguntas:** ¿eventos de dominio que generan alertas (vencimientos, demoras) por job programado o por evento? ¿Leído por usuario (ADR-007) con tabla de lecturas?
- **Condiciona:** ADR-007, RF-NOT-001.

### 22. Frontera transaccional de los efectos cruzados

- **Contexto:** `registrarEntrega` (remito + `FINALIZADO` + líneas del pedido), `markStopNoVisitada` (N reprogramaciones + parada) y `registerPod` (POD + entrega + parada) hoy son pasos sueltos (03, última sección). ADR-013 (enmienda) aceptó "no hay transacción real en este mock".
- **Preguntas:** ¿cada operación es una transacción? ¿`markStopNoVisitada` pasa a ser todo-o-nada **también** para las entregas, o se mantiene el éxito parcial?
- **Condiciona:** ADR-013, ADR-010 §3.

### 23. Las dos fuentes del tablero, y la analítica

- **Contexto:** `fetchDashboardData` (dataset estático, `services/mock/dashboard.service.ts:28`) convive con `getDashboardAggregates` (ADR-009). `AnalyticsPage` lee `analytics.data.ts` sin contrato.
- **Preguntas:** ¿se retira el tablero viejo? ¿La analítica se define como endpoints de agregados (RF-REP-001/003)?
- **Condiciona:** ADR-009.

### 24. Snapshot del cliente en el pedido y dirección de entrega

- **Preguntas:**
  - ¿El pedido congela los datos del cliente al confirmar (Doc 03 §17.28, "Snapshot comercial")?
  - ¿Qué dirección toma: fiscal, entrega del cliente, o la cargada en `OrderDeliverySection`?
- **Evidencia:** `PENDIENTES.md` #16/#17; hoy toma la fiscal y descarta lo que se carga en el modal.

### 25. Numeración de los otros documentos

- **Contexto:** solo el pedido tiene número correlativo (ADR-014).
- **Preguntas:** ¿remito, OC, recibo, factura y viaje llevan número propio por empresa (o por sucursal y punto de venta, en el caso fiscal)?
- **Condiciona:** ADR-014, RF-FAC-* (numeración fiscal).

### 26. ¿Dónde vive el código del backend?

- **Contexto:** `BackEnd/` existe vacío y **está en `.gitignore`** (`.gitignore:9-10`, "# BackEnd vacía por ahora"). Todo lo que se escriba ahí **no se versiona**, y no da ningún aviso.
- **Además:** la regla no tiene barra inicial, así que se aplica a toda carpeta `BackEnd/` en cualquier nivel. Con `core.ignorecase=true` (esta máquina, Windows) también atrapa `backend/` en minúscula: le pasó a esta misma auditoría (`FrontEnd/docs/historial/auditorias/backend/`, que tuvo que agregarse con `git add -f`). En Linux no ocurriría.
- **Opciones:**
  - A. Sacarlo del `.gitignore` y trabajar en un monorepo.
  - B. Repositorio separado.
- **Condiciona:** las reglas de trabajo del `PROTOCOLO.md` (rama `lean`, tags, merge), que hoy asumen un solo repo.
