# AUDIT 15 — Logística / Entregas

**Fecha:** 2026-09-09. **Commit auditado:** `f6a77ba` (rama `lean`). **Alcance:** solo lectura, ningún archivo de código fuente fue modificado. Todas las afirmaciones de este documento están verificadas contra el código real en esta sesión (lectura completa de archivos + `grep` de consumidores), no copiadas de un ADR o auditoría anterior sin comprobar.

**Ubicación real de este archivo:** `docs/historial/auditorias/` (no `docs/auditorias/`, que ya no existe — ver la reorganización de documentación de sesiones previas). `docs/historial/` es archivo, no lectura de entrada — este hallazgo se resume también en `docs/ESTADO.md`.

## Alcance revisado

`src/modules/logistics/` completo (`LogisticsPage.tsx`, 6 componentes, `deliveries.service.ts`, `deliveryStatusLabels.ts`), `src/shared/types/{logistics,deliveryNote,deliveryStatus}.types.ts`, `src/shared/types/ids.types.ts`, `src/shared/types/order.types.ts`, `src/modules/orders/api/orders.service.ts` (los puntos de contacto: `applyDeliveryToOrderLines`, `getOrdersSnapshotForAggregation`, `advanceOrderStatus`), `src/modules/orders/components/OrderDetailPanel.tsx`, `src/shared/utils/orderFulfillment.ts`, `src/shared/hooks/useLiveQuery.ts` y `usePagedQuery.ts` (la parte de `live`), `src/shared/api/uploads/uploads.service.ts` + `useEvidenceUpload.ts`, `src/modules/dashboard/api/dashboardAggregates.service.ts` (el único punto de acople logistics→dashboard), `docs/adr/ADR-001/002/003/005`, `docs/historial/verificaciones/VERIFICACION_TANDA_8.md`. Grep exhaustivo de `cash`/`caja`/`stock` sobre todo `src/modules/logistics/`. No se revisaron `src/data/mock/logistics.data.ts` línea por línea (18 registros, ya caracterizados por sesiones anteriores vía ADR-009) más allá de confirmar el conteo de campos.

## Modelo actual (puntos 1 a 9)

### 1. Modelo de datos actual

Todas las entidades son **tipos propios** en `shared/types/` — no encontré ninguna estructura ad-hoc de entrega definida dentro de un componente (`interface`/`type` local). La única estructura ad-hoc es el **draft de UI** en `RegistrarEntregaModal.tsx:30-34` (`LineDraft { entregar, rechazar, motivo }`), que es estado de formulario, no una entidad de dominio — se descarta al confirmar.

```
Delivery (logistics.types.ts:40-54)                    — un registro por VISITA a un cliente
  id: DeliveryId                                          (branded)
  orderId: Order['id']                                    (= OrderId, branded, vía tipo)
  branchId: Branch['id']                                  (branded)
  clientName: string                                      (texto libre, NO clientId)
  address, date, estimatedTime, zone, priority
  status: DeliveryStatus                                  (campo persistido, ver punto 2)
  collectionAmount: number
  historial: DeliveryHistoryEvent[]                       (append-only, 1:N)
  reprogramaciones: ReprogramacionEvent[]                 (append-only, 1:N)

DeliveryHistoryEvent (logistics.types.ts:21-27)         — evento de transición
  id: string                                              (NO tipado — sin DeliveryHistoryEventId)
  desde: DeliveryStatus | null, hasta, quien: string, cuando: string

ReprogramacionEvent (logistics.types.ts:32-38)          — evento de reprogramación
  fechaAnterior, fechaNueva, motivo: string (libre), responsable: string (libre), timestamp

DeliveryNote — "remito" (deliveryNote.types.ts:19-38)   — documento de entrega, 1 Delivery : N notes
  id: string                                              (NO tipado — sin DeliveryNoteId)
  orderId: OrderId, deliveryId: DeliveryId                (ambos branded)
  lines: DeliveryNoteLine[]
  evidenciaIds: string[]                                  (solo IDs, ver punto 5)
  creadoEn: string, creadoPor: string                     (NO tipado — nombre libre, no UserId)

DeliveryNoteLine (deliveryNote.types.ts:19-25)          — línea del remito
  orderLineId: OrderLineId                                (branded)
  cantidadOfrecida, cantidadEntregada, cantidadRechazada: number
  motivoRechazo?: string                                  (texto libre, ver punto 4)
```

**No existe "viaje".** `deliveryStatus.types.ts:4` y `deliveries.service.ts:28` usan la palabra "viaje" en los comentarios, pero no hay ninguna entidad `Trip`/`Viaje` en el código — cada `Delivery` es un registro plano, independiente, de una sola parada (un pedido, un destino). No hay vehículo, chofer, ni agrupación. **No existe "parada"** tampoco: no hay ningún tipo que separe "llegué pero no entregué" de "entregué"/"cancelé" — la unidad más chica es la `Delivery` completa.

**Relación real hoy (verificada, no supuesta):** el mock (`data/mock/logistics.data.ts`, ya caracterizado por sesiones anteriores vía ADR-009) tiene 18 `Delivery` para 6 `Order` — cada pedido tiene entre 2 y 3 `Delivery` en sucursales distintas. **Estas múltiples entregas del mismo pedido no tienen NINGUNA relación entre sí** más allá de compartir `orderId` — no hay campo "intento N de M", no hay orden entre ellas, no hay forma de saber si son reintentos de la misma mercadería o despachos parciales genuinamente distintos. Es una ambigüedad real del modelo actual, no una interpretación mía (ver hallazgo #4).

### 2. Estados

**Tres conceptos de "estado" coexisten hoy, ninguno consciente de los otros dos:**

1. **`Delivery.status`** (`logistics.types.ts:16`): `CREADO | EN_TRANSITO | FINALIZADO | REPROGRAMADO | CANCELADO`. Única fuente de verdad de las transiciones: `DELIVERY_TRANSITIONS` + `puedeTransicionar()` en `deliveryStatus.types.ts:23-33`. **Server-side (mock) es quien decide, no el cliente**: las 3 funciones que mutan estado (`transitionDelivery` `deliveries.service.ts:274-300`, `reprogramDelivery` `:326-363`, `registrarEntrega` `:387-443`) llaman a `puedeTransicionar()` DENTRO del `mock:` (lado servidor simulado) antes de aplicar el cambio. El cliente (`DeliveriesTable.tsx:89,95,101`) también llama a `puedeTransicionar()`, pero solo para decidir qué botón mostrar — es la MISMA función importada, no una copia, así que no hay riesgo de que cliente y servidor diverjan en la regla.
2. **`Order.status`** (`order.types.ts:15`): `pending | preparing | dispatched | delivered | invoiced | cancelled` — **una sola columna que mezcla estado comercial (`pending`/`cancelled`), logístico (`preparing`/`dispatched`/`delivered`) y financiero (`invoiced`)**. Única fuente de transición: `advanceOrderStatus` (`orders.service.ts:329-347`), lineal (`ORDER_STATUS_FLOW`), llamado SOLO por un botón manual en `OrdersPage.tsx:171` — nada en `deliveries.service.ts` lo invoca.
3. **`OrderFulfillmentStatus`** (`orderFulfillment.ts:12,24-32`): `pendiente | parcial | completo` — **derivado, nunca persistido**, calculado 100% client-side por `deriveOrderFulfillmentStatus()` a partir de `order.items` ya cargados (`OrderDetailPanel.tsx:107`). No es una "transición" que el cliente decida — es un cálculo de exhibición sobre datos que ya tiene, equivalente en espíritu a `computePurchaseOrderTotal`.

**Consecuencia verificada, no hipotética:** finalizar una `Delivery` (`registrarEntrega`) actualiza `cantidadEntregada` de las líneas del pedido (`applyDeliveryToOrderLines`, `orders.service.ts:433-453`) pero **nunca toca `Order.status`**. Un pedido puede tener su única `Delivery` en `FINALIZADO` (mercadería físicamente entregada) mientras `Order.status` sigue en `'preparing'` indefinidamente, hasta que alguien haga click manual en "Avanzar estado" en Pedidos — dos pantallas, dos verdades, sin sincronización automática. Ver hallazgo #2.

### 3. Historial y append-only

**Se cumple, verificado línea por línea.** `appendHistoryEvent()` (`deliveries.service.ts:269-272`) es la ÚNICA función que escribe en `historial` — retorna un objeto nuevo con `historial: [...delivery.historial, event]` (spread, nunca `.push`/mutación en lugar) y actualiza `status` en la MISMA operación, así que el campo "actual" y el log nunca pueden divergir (no son dos escrituras separadas que puedan desincronizarse). Las 3 funciones de transición (`transitionDelivery`, `reprogramDelivery`, `registrarEntrega`) pasan por acá siempre — no encontré ningún punto que escriba `delivery.status = X` directo sin pasar por `appendHistoryEvent`. `registrarEntrega` (`:437`) hace `deliveryNotesStore = [...deliveryNotesStore, note]` — solo agrega, nunca hay un `.map`/`.filter` que edite o borre un remito existente en todo el archivo (confirmado por lectura completa de `deliveries.service.ts`). No hay ningún `DELETE`/`UPDATE` sobre `historial`, `reprogramaciones` ni `deliveryNotesStore` en todo el módulo.

**Matiz honesto:** esto es "append-only funcional" (el único camino de escritura respeta el patrón), no "estado derivado 100% de eventos" en el sentido estricto de un event-sourcing real — `Delivery.status` sigue siendo un campo que se lee directo, no una proyección recalculada del array `historial` en cada lectura. Es la distinción que ADR-010 punto 3 pide resolver explícitamente para el modelo nuevo.

### 4. Entrega parcial y rechazo

- **`cantidadPedida`**: no existe ese nombre — es `OrderItem.quantity` (`order.types.ts:37`, comentario línea 26-28 documenta la convención explícitamente: "`quantity` cumple el rol de cantidadPedida... no se renombra para no forzar un cambio masivo").
- **`cantidadEntregada`**: campo real, persistido, acumulado por `applyDeliveryToOrderLines` (`orders.service.ts:433-453`, `item.cantidad_entregada + delta`, aditivo — nunca reemplaza).
- **`cantidadPendiente`**: **se deriva siempre**, nunca se persiste — `derivePendingQuantity()` (`orderFulfillment.ts:20-22`), `Math.max(0, quantity - cantidadEntregada)`. Se calcula tanto en el contrato conceptual (es una función pura importable desde cualquier lado) como en el cliente (`RegistrarEntregaModal.tsx:87,193` la llama directo sobre datos ya en memoria) — no hay un endpoint separado que la calcule "en el servidor", pero tampoco hace falta: es aritmética de 2 números ya presentes en el `Order` recibido, no una agregación sobre una colección.
- **El rechazo SÍ es evento de línea**, no estado — `cantidadRechazada`/`motivoRechazo` viven en `DeliveryNoteLine` (`deliveryNote.types.ts:19-25`), nunca en `DeliveryStatus`. `isRechazoTotal()` (`deliveryNote.types.ts:40-43`) lo deriva, no es un campo. Coincide exactamente con ADR-002.
- **Motivo de rechazo es texto libre**, sin catálogo — `motivoRechazo?: string` (`deliveryNote.types.ts:24`), input de texto simple en `RegistrarEntregaModal.tsx:219-227` (`<input type="text" placeholder="Motivo">`). Mismo patrón en reprogramación: `ReprogramarModal.tsx:99-102`, `<textarea>` libre.
- **Qué pasa con lo rechazado — verificado explícitamente, es un hallazgo, no una omisión:** `registrarEntrega` (`deliveries.service.ts:432-435`) filtra `lines.filter((l) => l.cantidadEntregada > 0)` antes de llamar a `applyDeliveryToOrderLines` — **lo rechazado nunca entra a ningún cálculo de stock ni de caja.** Confirmado por `grep` de `stock`/`cash`/`caja` sobre `src/modules/logistics/`: cero resultados de acoplamiento real (una sola mención de `stockStore` es un comentario que compara con un patrón de OTRO archivo, `products.service.ts`, no una importación). **La mercadería rechazada desaparece del sistema**: no vuelve a stock, no genera nota de crédito, no ajusta ninguna cuenta corriente. No existe ningún endpoint ni función con ese propósito en todo el proyecto.

### 5. Evidencia / POD

**Lo que existe:** `evidenciaIds: string[]` en `DeliveryNote` (`deliveryNote.types.ts:35`) — solo IDs, nunca el archivo. Flujo real vía `uploads.service.ts`: `signUpload()` (`:44-50`) devuelve una `uploadUrl` mock (`mock://uploads/...`) + `fileId`, `confirmUpload()` (`:61-68`) simula el `PUT`. **Se respeta ADR-005 al 100%**: cero base64 en cualquier JSON de este módulo (confirmado por `grep` de `base64` sobre `src/modules/logistics` y `src/shared/api/uploads`: 0 resultados), límites (`EVIDENCE_LIMITS`, `uploads.service.ts:20-24`: 5 archivos, 10MB, jpeg/png/webp/pdf) idénticos a los que documenta el ADR, reintento por archivo individual (`RegistrarEntregaModal.tsx:126-133` bloquea el submit si hay archivos en error o subiendo).

**Lo que NO existe, verificado por ausencia (0 resultados de grep en todo `src/modules/logistics` y `src/shared/types/deliveryNote.types.ts`):**
- Sin **receptor** (nombre, documento de quien recibió).
- Sin **firma** (ni path vectorial ni imagen dedicada — una firma tendría que subirse como "evidencia" genérica si alguien la escaneara, no hay campo propio).
- Sin **ubicación/GPS** de dónde se registró la entrega.
- Sin **timestamp de dispositivo** separado del `cuando`/`creadoEn` que ya pone el mock (que simula el reloj del servidor, no el del celular del chofer).
- **La evidencia solo existe para RECHAZOS** (`RegistrarEntregaModal.tsx:235`, el `<EvidenceUploader>` solo se renderiza si `hasAnyRejection`) — una entrega 100% exitosa no genera ninguna evidencia ni POD. No hay "foto de la entrega" para el caso feliz.

### 6. Tiempo real

**`useLiveQuery` está en uso real**, un solo consumidor: `LogisticsPage.tsx:120` (`useLiveQuery(getDeliveriesPage, filters, {...})`). No até ningún otro punto del proyecto que lo use hoy. Intervalo: **30 segundos exactos** (`usePagedQuery.ts:108`, `LIVE_REFETCH_INTERVAL_MS = 30_000`), coincide con ADR-003. **Se pausa en segundo plano**: `refetchIntervalInBackground: false` (`usePagedQuery.ts:215`), condicionado a `live === true`. **Volumen por tick**: la MISMA página paginada con los MISMOS filtros vigentes — nunca la lista completa (`usePagedQuery.ts:211-215`, el `refetchInterval` se aplica al mismo `useQuery` que ya pagina) — con `pageSize` default (25 según el resto del proyecto), el tope por tick es 25 filas + los `aggregates` (un objeto chico, `countByStatus`+2 números).

### 7. Listados y volumen

| Listado | ¿Pagina server? | Filtros/página/orden en URL | Agregación en cliente | Kanban/trae-todo |
|---|---|---|---|---|
| `getDeliveriesPage` (tabla principal) | Sí (`deliveries.service.ts:162-217`, corta con `.slice`) | Sí — `useUrlListState` (`LogisticsPage.tsx:59-61`): `status`/`preset`/`from`/`to`/página, sin prefijo (único listado de la página) | No — `countByStatus`/`pendingCollectionAmount` se calculan server-side (`:185-193`) antes de paginar | No, tabla (`DeliveriesTable.tsx`) |
| `getDeliveryNotesForDelivery` (remitos de una entrega) | **No** — `Array.filter` en memoria (`deliveries.service.ts:457-460`) | N/A (no es un listado con URL, es una lectura por modal) | — | — |

`getDeliveryNotesForDelivery` no pagina, pero el propio comentario del código (`:445-456`) lo justifica: es una lectura síncrona sobre remitos de UNA `Delivery` puntual — y como una `Delivery` deja de admitir `registrarEntrega` en cuanto pasa a `FINALIZADO` (`puedeTransicionar` lo impide, punto 2), el máximo real de remitos por entrega hoy es 1. **Es un riesgo latente, no activo**: si el modelo nuevo (ADR-010) permite reintentos/múltiples remitos por entrega, este mismo código dejaría de estar acotado sin que nadie lo note — ver hallazgo #9.

Sin `.filter`/`.sort`/`.reduce`/`useMemo` sobre una colección completa venida de la API en ningún componente de `logistics/` (verificado por `grep`, los únicos hits son sobre arrays de líneas de UN pedido — como mucho unas pocas decenas de filas, ya en memoria por otra razón — o sobre los filtros ya paginados). Sin Kanban (confirmado: `find -iname "*Kanban*" -o -iname "LogisticsCard*"` → 0 resultados; el Kanban original se reemplazó por tabla en `[28/08/2026]`, `docs/historial/DECISIONES_TECNICAS_LOG.md:72-103`). Query keys: `DeliveryQueryFilters` (`deliveries.service.ts:74-86`) exige `empresaId`+`branchId` explícitos en la firma (regla 3.5 del protocolo, ya corregido en el barrido de empresaId de una sesión anterior) — y `usePagedQuery`/`useLiveQuery` agregan `empresaId` a la query key de cache automáticamente por dentro (mismo mecanismo que el resto del proyecto).

### 8. IDs y relaciones

**Branded (`ids.types.ts`):** `DeliveryId`, `OrderId`, `OrderLineId`, `BranchId` — usados correctamente en `Delivery`, `DeliveryNote`, `DeliveryNoteLine`.

**String plano, sin branded type:**
- `DeliveryNote.id: string` (`deliveryNote.types.ts:28`) — no existe `DeliveryNoteId`.
- `DeliveryHistoryEvent.id: string` (`logistics.types.ts:22`) — generado `dh-${Date.now()}-${delivery.historial.length}` (`deliveries.service.ts:270`).
- `DeliveryNote.id` en runtime: `remito-${Date.now()}` (`deliveries.service.ts:420`) — mismo patrón `Date.now()`, riesgo de colisión si dos operaciones caen en el mismo milisegundo (bajo hoy, single-thread; relevante si esto migra a un backend real concurrente).
- **`quien`/`creadoPor`/`responsable`: los 3 son `string` libre**, resueltos por nombre completo tipeado (`fullName` de la sesión), no por un `UserId`/`EmpleadoId` tipado — no hay ningún tipo `Employee`/`Driver` en el proyecto todavía (esperable: el ABM de choferes es una capacidad de la matriz de brecha, punto 10).
- **`clientName: string` en `Delivery`** (`logistics.types.ts:44`) — a diferencia de `Order.clientId` (que SÍ es `ClientId` tipado desde Tanda 5), `Delivery` no tiene ninguna relación tipada hacia el cliente, solo el nombre snapshot. Para llegar del cliente real hay que pasar por `Order` (`delivery.orderId` → `Order.clientId`), la propia `Delivery` no lo resuelve.

### 9. Deuda y código no conectado

**Código sin conectar, verificado por `grep` de consumidores en todo `src/`:**
- **`toISODate`** (`deliveries.service.ts:63-68`), exportada, **0 consumidores reales** — `data/mock/logistics.data.ts` tiene su PROPIA función local `toISODate` (no importa la del service), así que la exportada del service queda huérfana desde que se escribió.

**Checklists de verificación pendientes (logística):**
- `docs/historial/verificaciones/VERIFICACION_TANDA_8.md` — **10 puntos, ninguno con evidencia de haberse ejecutado** en el repo (ningún commit posterior dice "confirmado en navegador" sobre esta tanda). No estaba capturado en el hallazgo ALTO #10 de `AUDIT_00_RESUMEN.md` (que lista 5 tandas: 3a/3b/3c/3d/3g) porque la Tanda 8 es del 2026-09-07, posterior a esa auditoría (2026-09-06) — ver hallazgo #8 más abajo.
- El propio `VERIFICACION_TANDA_8.md:34` documenta una deuda ya conocida y nunca resuelta: **no hay forma de corregir una `cantidadEntregada` ya aplicada** — un remito solo suma, nunca resta ("un remito de ajuste", mencionado como posibilidad futura en ADR-001, nunca implementado).

## Hallazgos

| # | Severidad | Archivo:línea | Descripción | Impacto con volumen | Propuesta |
|---|---|---|---|---|---|
| 1 | ALTO | `src/modules/logistics/services/deliveries.service.ts` (todo el archivo) | No existe ninguna función para crear una `Delivery` nueva — ni `createDelivery` ni equivalente en todo el proyecto (`grep` de `createDelivery`/`nuevaEntrega`/`newDelivery`: 0 resultados). Las 18 entregas del mock son estáticas; hoy no hay ningún camino, ni manual ni automático, para que un pedido nuevo genere una entrega. | No es un problema de volumen — es un techo funcional: el módulo no puede operar sobre datos reales hasta que exista esta función, sin importar cuántos pedidos haya. | Insumo directo para ADR-010/011 (motor de asignación) — no corregir acá, es exactamente lo que la extensión pedida debe resolver. |
| 2 | ALTO | `src/shared/types/order.types.ts:15` | `OrderStatus` mezcla estado comercial (`pending`/`cancelled`), logístico (`preparing`/`dispatched`/`delivered`) y financiero (`invoiced`) en una sola columna. Un pedido facturado y cancelado después no tiene forma de representarse sin perder uno de los dos hechos. | Con más estados logísticos reales (la lista de 11 estados que pide el punto 10), esta única columna se vuelve inmanejable — cada estado nuevo agregado multiplica combinaciones imposibles de expresar. | Insumo directo para ADR-010 punto 1 (tres ejes independientes). |
| 3 | ALTO | `src/modules/logistics/services/deliveries.service.ts:387-443` (`registrarEntrega`) y `src/modules/orders/OrdersPage.tsx:171` (`advanceOrderStatus`) | Finalizar una entrega nunca actualiza `Order.status`, y `Order.status` solo avanza por click manual en otra pantalla — los dos estados pueden divergir indefinidamente sin que nada lo detecte ni lo avise. | A más entregas por día, más pedidos quedan con `Order.status` desactualizado esperando que alguien recuerde avanzarlo a mano en otra pantalla — no escala con operación real. | Insumo directo para ADR-010 punto 1/3 (proyección server-side del estado, no dos escrituras manuales independientes). |
| 4 | MEDIO | `src/data/mock/logistics.data.ts` (relación implícita) + `src/shared/types/logistics.types.ts:40-54` | Un pedido puede tener múltiples `Delivery` (verificado: 18 `Delivery` para 6 `Order` en el mock, 2-3 por pedido) sin ninguna relación explícita entre ellas — no hay forma de distinguir "reintento de la misma mercadería" de "despacho parcial genuino" solo mirando el modelo. | Un reporte que sume `collectionAmount`/cantidades de todas las `Delivery` de un pedido sobreestimaría o subestimaría según cuál sea el caso real, sin poder saberlo del dato. | Insumo directo para ADR-010 punto 2 (jerarquía Viaje→Parada→Entrega) — la "parada" es exactamente lo que hoy falta para distinguir estos dos casos. |
| 5 | ALTO | `src/modules/logistics/services/deliveries.service.ts:274-300,326-363,387-443` | Ninguna de las 3 mutaciones (`transitionDelivery`, `reprogramDelivery`, `registrarEntrega`) recibe ni genera una clave de idempotencia — un reintento de red (típico en campo, con señal intermitente) puede duplicar un remito o repetir una transición. | Con choferes registrando entregas desde el celular en zonas de mala señal, un doble-submit por reintento automático del navegador/app duplicaría `cantidadEntregada` aplicada al pedido — corrompe el dato de cumplimiento, no solo la UI. | Insumo directo para ADR-010 punto 4. |
| 6 | ALTO | `src/modules/logistics/components/RegistrarEntregaModal.tsx:235-243`, `src/shared/types/deliveryNote.types.ts` (todo el archivo) | No existe ningún campo de Proof of Delivery (receptor, firma, ubicación, timestamp de dispositivo) — la evidencia (fotos/PDF) solo se pide y solo se guarda cuando hay rechazo; una entrega 100% exitosa no deja ningún registro más allá de la transición de estado. | Sin cambio de volumen — es una capacidad ausente, no un problema de escala. Relevante para la matriz de brecha (punto 10). | Insumo directo para ADR-010 punto 7. |
| 7 | MEDIO | `src/modules/logistics/services/deliveries.service.ts:430-435` | La mercadería rechazada no toca stock ni caja en ningún punto del código (confirmado por ausencia total de imports/menciones cruzadas) — desaparece del sistema sin generar ningún movimiento. | No es un problema de volumen, es un vacío contable: cuanta más mercadería se rechace, más diverge el stock/caja real del que el sistema cree tener, sin ningún rastro. | Insumo directo para ADR-010 punto 6 (logística inversa). |
| 8 | MEDIO | `docs/historial/verificaciones/VERIFICACION_TANDA_8.md` (los 10 puntos) | Checklist de verificación en navegador de la Tanda 8 sin ninguna evidencia de ejecución — y no estaba capturado en el hallazgo ALTO #10 de `AUDIT_00_RESUMEN.md` (que solo lista Tandas 3a/3b/3c/3d/3g) porque la Tanda 8 es posterior a esa auditoría. | — (deuda de verificación, no de código). | Ejecutarlo antes de extender el módulo — varios de los hallazgos de esta auditoría (idempotencia, sincronización de estados) son más fáciles de validar en código que en pantalla, pero el resto del flujo (rechazo, evidencia, reprogramación) solo se confirma a mano. |
| 9 | BAJO | `src/modules/logistics/services/deliveries.service.ts:445-460` (`getDeliveryNotesForDelivery`) | No pagina — hoy está acotado de hecho (máximo 1 remito por entrega, porque `FINALIZADO` es terminal), pero si el modelo nuevo permite reintentos con múltiples remitos por entrega, este código deja de estar acotado sin que nadie lo note ni lo pida como cambio explícito. | Bajo hoy; se vuelve relevante en el mismo momento en que ADR-010 habilite más de un remito por entrega. | Si ADR-010 habilita reintentos, este listado necesita paginar o al menos un techo explícito, en la misma tanda que lo habilite. |
| 10 | BAJO | `src/modules/logistics/services/deliveries.service.ts:63-68` (`toISODate`) | Función exportada sin ningún consumidor real — `data/mock/logistics.data.ts` tiene su propia copia local, no importa esta. | — | No borrar (regla del protocolo) — dejar listada; si ADR-010 no la necesita, es candidata a limpieza en la tanda de implementación. |
| 11 | BAJO | `src/modules/logistics/services/deliveries.service.ts:270,420` | IDs de eventos/remitos generados con `Date.now()` sin sufijo verdaderamente único más allá de un contador de longitud de array — colisión improbable en el mock single-thread, pero mal patrón si se migra a un backend con escritura concurrente real. | Bajo con el volumen mock actual; relevante si el backend real permite dos operaciones en el mismo milisegundo desde clientes distintos. | Reemplazar por un ID generado server-side con garantía real de unicidad cuando exista backend — no urgente hoy. |
| 12 | BAJO | `src/modules/logistics/LogisticsPage.tsx:130-133,182-184` (`handlePrintRoute`) | El botón "Imprimir Hoja de Ruta" no hace nada más que un `console.log` — no genera ningún documento, no abre diálogo de impresión. | — | Insumo para ADR-011 punto 7 (documentos impresos vía job server-side) — hoy es un placeholder visible al usuario que promete una función que no existe. |
| 13 | BAJO | `src/shared/types/deliveryNote.types.ts:28`, `logistics.types.ts:22` | `DeliveryNote.id` y `DeliveryHistoryEvent.id` son `string` plano, sin branded type (`DeliveryNoteId` no existe) — a diferencia de `DeliveryId`/`OrderId`/`OrderLineId` que sí lo son. | — | Si ADR-010 amplía la jerarquía de entidades, tipar los IDs nuevos desde el día uno (mismo patrón ya establecido en `ids.types.ts`) en vez de repetir el gap. |

**Ningún hallazgo BLOQUEANTE.** Ninguno corrompe datos entre empresas/sucursales, ninguno es una regresión de algo que funcionaba y dejó de funcionar — todos son gaps funcionales frente al modelo que el negocio necesita, exactamente lo que esta auditoría se pidió para encontrar antes de escribir ADR-010/011.

## Matriz de brecha (punto 10)

| Capacidad | Estado | Justificación | Archivo (o "no existe") |
|---|---|---|---|
| Entrega parcial trazable por producto | **IMPLEMENTADA** | `cantidadEntregada` por línea, acumulada por remito, `cantidadPendiente` derivada — caso guía de ADR-001 (100/70/30) verificado contra el código. | `deliveryNote.types.ts`, `orders.service.ts:433-453`, `orderFulfillment.ts` |
| Rechazo total de mercadería | **IMPLEMENTADA** | `isRechazoTotal()` deriva de las líneas del remito, sin campo propio — coincide con ADR-002. | `deliveryNote.types.ts:40-43` |
| Entrega rechazada con motivo, fecha, responsable, productos, cantidades y evidencia | **PARCIAL** | Motivo (texto libre)/fecha/productos/cantidades/evidencia sí; **responsable de la entrega** (quién la rechazó del lado del cliente) no existe — solo `creadoPor` (quién cargó el remito del lado de la empresa). | `deliveryNote.types.ts`, `RegistrarEntregaModal.tsx` |
| Reprogramación de entregas | **IMPLEMENTADA** | Fecha nueva + motivo + responsable, vuelve a `CREADO`, evento append-only — coincide con ADR-002. | `deliveries.service.ts:326-363`, `ReprogramarModal.tsx` |
| Seguimiento del viaje en tiempo real | **PARCIAL** | Polling cada 30s del LISTADO de entregas (estado, no ubicación) — no hay ninguna noción de posición/GPS ni "viaje" que seguir, solo el estado de cada entrega individual. | `useLiveQuery.ts`, `LogisticsPage.tsx:120` |
| Relación orderId tipada hacia orders | **IMPLEMENTADA** | `Delivery.orderId: Order['id']` = `OrderId` branded. | `logistics.types.ts:42` |
| Entrega NO realizada, distinguida de cancelación del pedido | **INEXISTENTE** | `DeliveryStatus` no tiene un estado "no entregado" distinto de `CANCELADO` — y `CANCELADO` es de la `Delivery`, no del `Order` (que tiene su propio `cancelled` independiente). No hay forma de decir "se intentó y no se pudo" sin cancelar. | no existe |
| Reintento de entrega (incidencia → reprogramación → nuevo intento) | **PARCIAL** | Reprogramación existe (vuelve a `CREADO`), pero no hay un evento "incidencia" separado que la dispare — hoy se reprograma sin distinguir "no había nadie" de "el cliente pidió otro día" más allá del texto libre de motivo. | `deliveries.service.ts:326-363` |
| Confirmación de entrega física | **IMPLEMENTADA** (mínima) | `registrarEntrega` finaliza la `Delivery` — pero sin ningún dato de quién confirmó del lado del cliente (ver POD abajo). | `deliveries.service.ts:387-443` |
| Proof of Delivery (fecha, hora, receptor, firma, imagen, ubicación, observaciones) | **PARCIAL** | Fecha/hora sí (`creadoEn`); receptor, firma, ubicación, observaciones: no existen. Imagen solo si hubo rechazo. | `deliveryNote.types.ts` |
| Estado logístico completo (11 estados pedidos) | **INEXISTENTE** | Hoy son 5 estados de `Delivery` (`CREADO/EN_TRANSITO/FINALIZADO/REPROGRAMADO/CANCELADO`), sin `Asignado`/`En preparación`/`Preparado`/`Embalado`/`Despachado`/`Incidencia`/`Devuelto`. | `deliveryStatus.types.ts:23-29` |
| Estado comercial del pedido separado del estado logístico | **INEXISTENTE** | Ver hallazgo #2 — una sola columna mezcla los dos (y el financiero). | `order.types.ts:15` |
| Entidad Viaje que agrupa pedidos preparados con vehículo y chofer | **INEXISTENTE** | Ver punto 1 — cada `Delivery` es independiente, sin agrupación. | no existe |
| Motor de asignación de pedidos a viajes | **INEXISTENTE** | No hay ni `Viaje` a quién asignar, ni función de asignación, ni siquiera `createDelivery` (hallazgo #1). | no existe |
| Vehículos (ABM) | **INEXISTENTE** | Sin tipo, sin mock, sin componente — `grep` de `Vehicul`/`vehicle` en `src/`: 0 resultados relevantes. | no existe |
| Choferes (ABM) | **INEXISTENTE** | `'Chofer'` existe como `SystemRole` (`settings.types.ts:5`, `TabUsersRoles`) — es un ROL de acceso al sistema, no una entidad operativa de logística (sin licencia, vehículo asignado, disponibilidad). No hay ningún ABM de choferes como recurso; `quien`/`responsable` en entregas siguen siendo texto libre, sin relación hacia ningún usuario tipado. | `settings.types.ts:5` (rol, no ABM logístico) |
| Validación de capacidad del vehículo | **INEXISTENTE** | Depende de que exista `Vehículo` primero. | no existe |
| Tabla paginada como patrón de lista para Entregas | **IMPLEMENTADA** | `getDeliveriesPage` server-side, `DeliveriesTable` (no Kanban), verificado en el punto 7. | `deliveries.service.ts:162-217`, `DeliveriesTable.tsx` |
| Logística inversa (retorno de mercadería rechazada al depósito) | **INEXISTENTE** | Ver hallazgo #7 — lo rechazado no genera ningún movimiento de stock. | no existe |
| Rendición / cierre de viaje | **INEXISTENTE** | No hay "viaje" que cerrar (depende de que exista la entidad primero); tampoco hay ninguna noción de rendición de efectivo pese a que `collectionAmount`/"Efectivo en la Calle" sí se trackea por entrega individual (`LogisticsKPIs.tsx:51-53`) — el dato existe disperso, pero nada lo consolida ni lo concilia contra caja. | no existe |

## Qué está bien en general (para no romperlo después)

- **La máquina de estados de `Delivery` tiene una única fuente de verdad real**, no solo documentada: `puedeTransicionar()` se llama server-side (dentro del `mock:`) en las 3 mutaciones, y el cliente usa la MISMA función (no una copia) para decidir qué botones mostrar — cero riesgo de que cliente y servidor diverjan en la regla (`deliveryStatus.types.ts`, `DeliveriesTable.tsx:89,95,101`).
- **Append-only genuino en el único camino de escritura** — `appendHistoryEvent` actualiza `status` e `historial` en la misma operación atómica del lado del código, nunca dos escrituras separadas que puedan desincronizarse (punto 3).
- **ADR-005 (evidencia) se respeta al 100%** — cero base64, límites idénticos a los documentados, reintento por archivo individual, bloqueo de envío con evidencia incompleta.
- **ADR-003 (tiempo real) se respeta al 100%** — 30s exactos, pausa en background, nunca trae la lista completa, todo detrás de un hook reemplazable (`useLiveQuery`) sin que ningún componente conozca el mecanismo de transporte.
- **El rechazo es genuinamente información de línea, no un estado inventado** — ni `Delivery.status` ni ningún otro campo tiene un valor "RECHAZADO"; coincide con ADR-002 punto por punto.
- **`cantidadPendiente` nunca se persiste** — se deriva siempre con la misma función pura, sin ningún punto que la calcule dos veces con lógica distinta.
- **La capa `api/`+`empresaId` explícito ya está resuelta** en este módulo (barrido de sesión anterior) — cualquier función nueva que ADR-010/011 agregue tiene el patrón a seguir ya establecido en el propio archivo.

## Preguntas abiertas para Leandro

1. **Corrección de una `cantidadEntregada` ya aplicada** (deuda ya declarada en `VERIFICACION_TANDA_8.md`, nunca resuelta): ¿un remito de ajuste (posiblemente negativo) o una edición controlada del último remito? Afecta directamente el diseño de ADR-010 punto 3 (proyección de eventos) — un remito de ajuste encaja naturalmente en un log append-only; una edición no.
2. **¿Qué significa "cancelar" una `Delivery` hoy** (`CANCELADO`, terminal, sin distinguir de `Order.status: 'cancelled'`) **una vez que exista un estado logístico separado del comercial**? ¿Cancelar la entrega cancela el pedido, o son independientes (se puede cancelar el envío y reprogramar sin tocar el pedido)?
3. Las 18 `Delivery` del mock con múltiples entregas por pedido en sucursales distintas (hallazgo #4) — ¿es un dato de prueba sin intención real, o refleja un caso de negocio genuino (despacho parcial desde depósitos distintos) que el modelo nuevo debe soportar explícitamente?
4. ¿La "rendición de efectivo" (dinero cobrado en la calle, hoy solo agregado como KPI de exhibición) es alcance de ADR-010/011, o queda deliberadamente fuera para una decisión posterior junto con `cash`?
