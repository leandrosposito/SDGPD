# ADR-010 — Modelo logístico

**Estado:** Aceptado (2026-09-09, con las correcciones de la revisión del 2026-09-09 aplicadas — ver cada sección). **Fecha:** 2026-09-09. Parte del modelo real hoy, verificado en `AUDIT_15_LOGISTICA.md` — no de un modelo ideal en el vacío. Extiende ADR-001/ADR-002 (siguen vigentes, ver "Qué se conserva" en cada sección); ADR-005 no cambia. ADR-003 se enmienda (ver la enmienda fechada en `ADR-003-tiempo-real.md`), no se reemplaza.

## Problema

El módulo de entregas actual (`AUDIT_15_LOGISTICA.md`) no distingue la operación logística del hecho comercial del pedido, y el estado logístico real de un pedido en un distribuidor tiene más pasos de los que hoy están modelados. Concretamente, la auditoría confirmó:

- `OrderStatus` es una sola columna que mezcla estado comercial, logístico y financiero (hallazgo #2/#48).
- Finalizar una entrega no sincroniza `Order.status` — pueden divergir sin que nada lo detecte (hallazgo #3/#49).
- No existe ninguna función para crear una `Delivery` (hallazgo #1/#47) — el modelo actual no tiene ni siquiera el escalón más básico para operar sobre pedidos reales.
- Un pedido puede tener múltiples `Delivery` sin relación explícita entre ellas (hallazgo #4/#52).
- Ninguna mutación tiene clave de idempotencia (hallazgo #5/#50).
- No hay ningún campo de Proof of Delivery más allá de fecha/hora (hallazgo #6/#51).
- Lo rechazado no toca stock ni caja (hallazgo #7/#53).

## Qué se conserva de lo que ya existe

- **`puedeTransicionar` + mapa de transiciones tipado** (ADR-002): el patrón de "un único mapa, ninguna transición decidida por un componente" se extiende a los tres niveles nuevos (Viaje/Parada), no se reemplaza.
- **Remitos append-only, líneas con `orderLineId` tipado** (ADR-001): `DeliveryNote`/`DeliveryNoteLine` siguen siendo el documento de negocio real; se cuelgan de `Entrega` (ver sección 2) en vez de directo de `Delivery`, pero su forma no cambia.
- **`cantidadPendiente` derivada, nunca persistida** (ADR-001): se mantiene sin cambios.
- **Rechazo como evento de línea, no como estado** (ADR-002): se mantiene — el rechazo total sigue siendo `isRechazoTotal()` sobre las líneas, nunca un estado propio.
- **`useLiveQuery`/polling 30s/`refetchIntervalInBackground: false`** (ADR-003): sin cambios, se reutiliza tal cual para el seguimiento de Viaje.
- **URL prefirmada, nunca base64, límites de `uploads.service.ts`** (ADR-005): sin cambios, se reutiliza para POD (sección 7).

---

## 1. Ejes de estado

**Caso guía:** pedido de 100 unidades, entregado 70, rechazado 30 por daño, ya facturado por 100.

### Opción A — Tres ejes independientes (comercial / logístico / financiero)

- **Comercial** (en `Order`, campo escribible): `Borrador | Confirmado | Cancelado`.
- **Financiero** (en `Order`, **proyección de solo lectura, NO campo escribible**): `Sin facturar | Facturado | Cobrado | Con nota de crédito`, derivada de los comprobantes (facturas/recibos/notas de crédito) reales del pedido — hoy esos comprobantes son mock y la proyección puede devolver un valor fijo/simplificado, pero el mecanismo desde el día uno es "se deriva de documentos", nunca "se escribe a mano". **Corrección de la revisión 2026-09-09:** la versión original de este ADR lo proponía como campo escribible — se corrige porque Facturación no existe todavía como dominio y ya tiene contradicciones abiertas sobre cuál es el disparador real de la factura; un campo escribible en `Order` garantizaría una segunda fuente de verdad para "cobrado" el día que Facturación exista, exactamente el error que ADR-001 ya evitó con `cantidadPendiente`.
- **Logístico**: no vive en `Order` como campo propio — vive en la `Parada` (ver sección 2), con el `Order` exponiendo un **resumen derivado**, nunca un campo persistido redundante (mismo principio que `cantidadPendiente`/`deriveOrderFulfillmentStatus` de ADR-001, que ya funciona bien hoy).

**Los dos ejes no-comerciales son ambos proyecciones de solo lectura, por el mismo principio** — ninguno de los dos es un campo que un usuario o un componente escriba directo: el financiero se deriva de comprobantes, el logístico se deriva de la Parada activa.

**Caso guía resuelto:** Comercial = `Confirmado`. Financiero = `Facturado`. Logístico (derivado de la Parada) = `Incidencia` (terminó la visita, no todo se entregó) + el `OrderFulfillmentStatus` ya existente (`parcial`, 70/100) sigue siendo el resumen de cantidad, sin inventar un cuarto eje — es ortogonal al estado de la Parada, no un reemplazo. Los tres hechos conviven sin contradicción y sin inventar una cuarta combinación de texto.

**Ventajas:** cada eje cambia por su propia razón de negocio, sin combinaciones imposibles; facturar no depende de haber entregado (facturación anticipada es un caso real); cancelar el envío no cancela el pedido (ver capacidad "Entrega NO realizada" de la matriz de brecha). **Costo:** 1 campo escribible nuevo (comercial, ya existía como `status`) + 2 proyecciones de solo lectura (logístico y financiero) en vez de 1 campo mezclado, más superficie para migrar en la UI que hoy lee `order.status` en un solo lugar (`OrderDetailPanel`, `OrdersPage`, exports).

### Opción B — Un solo estado compuesto (el actual, extendido)

Agregar los estados logísticos nuevos al mismo enum de `OrderStatus`. **Descartada**: es literalmente el problema que el hallazgo #2 describe — con 11 estados logísticos × comercial × financiero, el enum crece a decenas de valores, la mayoría sin sentido de negocio (`'invoiced-preparing-cancelled'`), y cualquier lectura nueva (¿está facturado?) exige parsear el string en vez de leer un campo.

### Opción C — Dos ejes (logístico+comercial fusionados, financiero aparte)

Intermedia: fusionar comercial y logístico (son ambos "qué pasa con el pedido en general"), separar solo lo financiero. **Descartada** por la misma razón que B a menor escala: "Confirmado y en tránsito" y "Confirmado y con incidencia" siguen siendo dos hechos independientes que un solo campo no representa sin combinarlos.

**Recomendación: Opción A.**

---

## 2. Jerarquía de entidades

### Opción A — Viaje → Parada → Entrega → Línea de entrega

```
Viaje                                    (agrupa, tiene vehículo+chofer)
  status: Planificado | EnCurso | Cerrado | Cancelado
  vehiculoId, choferId
  paradas: Parada[]                      (ordenadas — ver ADR-011 punto 5)

Parada                                   (una visita física, 1 dirección)
  status: Pendiente | Asignado | En preparación | Preparado | Embalado |
          Despachado | En tránsito | Entregado | Cancelado | Incidencia | Devuelto
  viajeId, direccion
  entregas: Entrega[]                    (1+ pedidos en la misma parada)

Entrega (= DeliveryNote de hoy, renombrado por claridad de dominio)
  orderId, paradaId
  lines: EntregaLinea[]                  (= DeliveryNoteLine de hoy, sin cambios)
  evidenciaIds, POD (ver sección 7)

EntregaLinea = DeliveryNoteLine (ADR-001, sin cambios)
```

**Cómo se deriva el estado hacia arriba:**
- `Parada.status` es la única fuente real (el mapa de transiciones vive acá, extendiendo `deliveryStatus.types.ts`).
- El "estado logístico" que se le muestra al `Order` es el `status` de su Parada activa (la más reciente sin terminar, o la última si todas terminaron) — **derivado, nunca copiado a un campo de `Order`**. Un pedido sin ninguna Parada todavía tiene estado logístico derivado = `Pendiente` (no existe registro, no hace falta uno para representar "todavía no se le asignó nada").
- `Viaje.status` es un campo propio (no derivado de sus Paradas) porque su ciclo de vida es distinto: un Viaje se `Cierra` como acción explícita del operador (ver ADR-011 "rendición"), no automáticamente cuando la última Parada termina — puede haber Paradas Canceladas y el Viaje seguir `EnCurso` con las demás.

**Multi-intento resuelto (hallazgo #4):** un pedido con un intento fallido y uno exitoso hoy son 2 `Delivery` sin relación. Con esta jerarquía, son 2 `Parada` distintas (de 2 `Viaje` distintos, probablemente en fechas distintas) — cada una con su propio ciclo completo, y la relación "intento 2 de este pedido" es simplemente "otra Parada con el mismo `orderId` en su Entrega, creada después". Ya no hace falta inventar un campo "número de intento": se deriva de `creadoEn`.

**Costo:** 4 niveles en vez de 1 — el modal "Registrar entrega" de hoy asume una `Delivery` = un pedido = una Parada; con Paradas multi-pedido, ese modal tiene que operar sobre "todas las Entregas de esta Parada", no una a la vez. Migración de UI no trivial (ver sección 8).

### Opción B — Modelo plano actual, extendido con campos de vehículo/chofer en `Delivery`

Agregar `viajeId`/`vehiculoId`/`choferId` directo a `Delivery`, sin Parada intermedia. **Descartada:** no resuelve el caso "llegué y no entregué" sin confundirlo con "el pedido se canceló" (exactamente el problema que la Parada existe para resolver, según el enunciado del ADR) — sin Parada, `Delivery.status = CANCELADO` sigue significando dos cosas distintas a la vez.

### Opción C — Viaje → Entrega directo (sin Parada, un viaje agrupa entregas sueltas)

Más simple que A, pero pierde la noción de "una visita física puede llevar 2 pedidos del mismo cliente" — cada entrega quedaría con su propia dirección/horario aunque en la práctica el camión pare una sola vez. **Descartada** por la misma razón que B, a menor escala: sigue sin poder decir "llegué a esta dirección y de los 2 pedidos entregué 1".

**Recomendación: Opción A.**

---

## 3. Eventos append-only y proyección

### Opción A — Estado como campo materializado, actualizado atómicamente junto al evento (extiende el patrón actual)

Igual que `appendHistoryEvent` hoy (`deliveries.service.ts:269-272`): cada transición escribe el evento Y actualiza el campo `status` en la misma operación — nunca dos escrituras separadas. La proyección "estado actual" no se recalcula leyendo todo el historial en cada GET (sería caro sin necesidad); se recalcula solo cuando se aplica un evento nuevo.

**Contrato de API, explícito y obligatorio:** todo GET de una Parada/Viaje devuelve `{ estadoActual, allowedTransitions: AllowedTransition[] }` — `allowedTransitions` **calculado server-side**, no una constante que el cliente reimplementa. **Corrección de la revisión 2026-09-09:** `allowedTransitions` NO es un array de strings (los estados a los que se puede ir) — es un array de OBJETOS, uno por cada transición conceptualmente posible desde el estado actual: `{ transicion: EstadoX, permitida: boolean, motivo?: string }`. Si solo mandara la lista de las permitidas, el cliente tendría que deducir por qué las demás no lo están — y ahí es donde reimplementaría la regla de negocio por la puerta de atrás (ej. "si no está CREADO, no puede ir a EN_TRANSITO, entonces..."). Con el objeto completo, cada transición no permitida trae su propio `motivo` server-side (ej. `"Ya está finalizada"`, `"Requiere evidencia de la línea rechazada primero"`) — el cliente solo lee y muestra, nunca infiere.

Esto es un cambio real respecto de hoy: hoy el cliente llama a la MISMA función `puedeTransicionar` que el mock usa "server-side" porque es un mock en el mismo proceso — funciona por accidente de que no hay red de por medio. Con un backend real, el cliente NO puede importar código TypeScript del servidor — el contrato tiene que devolver `allowedTransitions` como DATO en la respuesta, no asumir que el cliente tiene la misma función. `DeliveriesTable.tsx:89,95,101` hoy decide qué botón mostrar llamando a `puedeTransicionar` importada — el día que haya backend real, ese código debe leer `allowedTransitions` de la respuesta en vez de recalcular.

**Ventaja:** barato de leer (no recorre el log en cada GET), y cierra exactamente el antipatrón ya señalado en la auditoría anterior (cliente derivando estado/reglas de transición por su cuenta) — el cliente nunca vuelve a implementar la máquina de estados, ni siquiera "por casualidad" como hoy. **Costo:** el mock tiene que empezar a devolver `allowedTransitions` explícito en cada respuesta (hoy no lo hace, el cliente infiere llamando a la función compartida) — cambio de contrato, no solo de implementación interna.

### Opción B — Estado 100% derivado, recalculado desde el log en cada lectura (event sourcing estricto)

Más "puro" arquitectónicamente, pero cada GET de una Parada recorre su historial completo para saber el estado actual. **Descartada** para este volumen: no hay ningún caso de uso hoy (ni proyectado) que necesite reproducir el estado en un punto arbitrario del pasado — el costo de recalcular en cada lectura no se justifica sin ese requisito. Si aparece esa necesidad (auditoría legal, "cuál era el estado el día X"), se resuelve con un snapshot puntual sobre el mismo log append-only que ya existe, sin cambiar el modelo de escritura.

**Recomendación: Opción A**, con el cambio de contrato (`allowedTransitions` explícito) marcado como no-negociable — es la única forma de que la garantía de "una sola fuente de verdad" sobreviva a la llegada de un backend real separado del cliente.

---

## 4. Idempotencia

### Opción A — Clave generada por el cliente (UUID v4), al momento de iniciar la acción

**Corrección de la revisión 2026-09-09 (momento de generación):** el cliente genera un `Idempotency-Key` (UUID v4) **cuando se forma la INTENCIÓN del usuario** — al abrir el modal de "Registrar entrega"/"Reprogramar"/transición, o al componer la acción en memoria — **NO en el momento de enviar el request**. La versión original de este ADR decía "al confirmar la acción", que es tarde: si la clave se genera recién al hacer el fetch, un reintento automático del navegador (o un segundo tap por señal intermitente) dispara un fetch NUEVO con una clave NUEVA, y la idempotencia no protege nada — el propósito completo del mecanismo se pierde si la clave nace en el mismo punto que podría repetirse. La clave se adjunta al request (header o campo del body, a definir en la implementación) y se conserva localmente hasta recibir una respuesta exitosa.

Ante un duplicado, el servidor **devuelve el resultado ya guardado de la primera vez** — nunca un error, nunca un `409`: reintentar tiene que ser **indistinguible, del lado del cliente, de haber salido bien la primera vez**. Esto es más estricto que un simple "no reaplicar el efecto": el contrato completo (status code, forma de la respuesta) del segundo request es igual al del primero exitoso. Vida de la clave: hasta que el cliente confirme éxito y la descarte, o indefinida si se implementa la cola offline mencionada en el problema (se conserva junto con la operación encolada).

**Ventaja:** no depende de una llamada previa al servidor para obtener la clave (funciona offline-first, precondición del problema planteado). **Costo:** el servidor necesita guardar, por un tiempo razonable, qué claves ya procesó y qué devolvió — una tabla/mapa `idempotencyKey → resultado` con expiración (ej. 24-48hs, suficiente para cualquier reintento realista).

### Opción B — Clave pedida al servidor antes de la operación (`POST /operations/token` → usar el token)

Descartada para este caso: agrega una ida y vuelta de red ANTES de poder intentar la operación real — exactamente lo que no se puede pedir a un chofer con señal intermitente (necesitaría 2 requests exitosos en vez de 1 para completar una sola acción).

### Opción C — Idempotencia por clave natural (hash del payload: `paradaId` + `lines` + `timestamp` redondeado)

Descartada: dos operaciones LEGÍTIMAMENTE distintas (dos remitos separados por error humano, cargados con los mismos números) colisionarían y una se perdería en silencio — el costo de un falso positivo (perder un evento real) es peor que el de no tener idempotencia.

**Recomendación: Opción A.**

---

## 5. Catálogo de motivos

### Opción A — Catálogo configurable por empresa: código estable + descripción editable

`MotivoRechazo { codigo: string, descripcion: string, activo: boolean, requiereEvidencia: boolean, disparaLogisticaInversa: boolean }`, administrado por empresa (mismo patrón de configuración que ya existe para otros catálogos del proyecto). El `codigo` nunca cambia una vez creado (lo que se reporta/agrupa), la `descripcion` es editable (lo que ve el usuario). **Corrección de la revisión 2026-09-09:** cada motivo lleva dos flags de comportamiento, no solo metadatos descriptivos — `requiereEvidencia` (si es `true`, `RegistrarEntregaModal` no deja confirmar sin al menos 1 archivo adjunto para esa línea, en vez de la regla actual "si hay rechazo, se pide evidencia" pareja para todos los motivos) y `disparaLogisticaInversa` (si es `true`, la línea entra al circuito de la sección 6 al confirmarse; un motivo como "el cliente rechazó por error de carga nuestro, ya se resolvió en el momento" podría no disparar retorno físico si la mercadería nunca salió del camión — el catálogo decide caso por caso, no una regla global). Se agrega un motivo `OTRO` con un campo de texto libre opcional al lado, para no bloquear un caso real que el catálogo todavía no previó — **los textos cargados bajo `OTRO` tienen que ser consultables** (un listado/reporte propio, no solo guardados sin forma de revisarlos) para que alguien los revise periódicamente y decida si ameritan un código nuevo en el catálogo.

**Ventaja:** métricas reales ("¿por qué rechazamos más este mes?") — hoy es imposible, `motivoRechazo` es texto libre sin dos entradas garantizado iguales (`RegistrarEntregaModal.tsx:219-227`). **Costo:** una pantalla de ABM nueva (Configuración) + migración de los motivos ya cargados como texto libre a códigos (con `OTRO` + el texto original preservado, no se pierde información histórica).

### Opción B — Texto libre (el actual)

**Descartada** como estado final — es exactamente el hallazgo que este punto busca cerrar — pero se mantiene como fallback dentro de la Opción A (`OTRO` + texto), no se elimina la posibilidad de que el usuario diga algo que el catálogo no previó.

**Recomendación: Opción A**, aplicada igual a motivos de reprogramación y de no-entrega (mismo mecanismo, catálogos separados por tipo de evento).

---

## 6. Logística inversa

### Opción A — Estado "en retorno" en la Entrega + confirmación manual de recepción en depósito

Cuando una `EntregaLinea` tiene `cantidadRechazada > 0`, el sistema marca esa porción como **"en retorno"**. **Corrección de la revisión 2026-09-09:** esto no puede ser solo un metadato descriptivo de la línea — tiene que existir como **cantidad en un estado propio, `cantidadEnTransitoDeRetorno`**, visible en cualquier consulta de "cuánto hay realmente dando vueltas" entre el momento del rechazo y la recepción física. Sin esta cantidad como dato de primera clase, esas 28-30 unidades son inventario invisible durante las horas que el camión tarda en volver al depósito — no aparecen como stock disponible (correcto, no lo están) pero tampoco aparecen en ningún reporte de "qué hay en tránsito" (incorrecto: existen, están en algún lado, alguien puede preguntar por ellas). `cantidadEnTransitoDeRetorno` se pone al confirmar el rechazo (`registrarEntrega`) y se resuelve a 0 (repartida entre lo efectivamente recibido y cualquier diferencia, ver abajo) al confirmar la recepción.

Un endpoint separado, **`confirmarRecepcionDevolucion`**, disparado manualmente por el depósito cuando el camión vuelve, es el único punto que genera el movimiento real de stock: reingreso a stock disponible, o a una ubicación de "cuarentena" (a elección del usuario en ese momento, según si la mercadería dañada es revendible). Si el pedido ya estaba facturado, este mismo endpoint es el que dispara (o deja pendiente de decisión manual) la nota de crédito correspondiente — no automático, porque una devolución no siempre implica devolver dinero (podría reponerse con producto nuevo en un pedido futuro).

**Qué pasa cuando lo declarado no coincide con lo recibido (declarado 30, recibido 28) — corrección de la revisión 2026-09-09, es un caso NORMAL del endpoint, no una excepción a manejar aparte:** `confirmarRecepcionDevolucion` recibe la cantidad REAL contada en depósito por línea, independiente de la `cantidadRechazada` que declaró el chofer en la calle. Si difieren, el endpoint no falla ni bloquea — aplica la cantidad real al stock/cuarentena, y dejar registrada la diferencia (2 unidades, en el ejemplo) como un hecho propio del evento de recepción (quién contó, cuándo, la diferencia entre declarado y recibido) — mismo criterio de "nunca perder el dato, nunca inventar reconciliación automática" que ya rige el resto del proyecto. Qué se hace operativamente con esa diferencia (¿se busca?, ¿se da por perdida?, ¿responsabilidad del chofer?) es una decisión de proceso que este ADR no resuelve — el sistema solo garantiza que la diferencia queda registrada, no que se resuelve sola.

**Ventaja:** no inventa stock que todavía no está físicamente en el depósito (un reingreso automático en el momento del rechazo, cuando la mercadería todavía está en la calle, sería un dato falso). **Costo:** un paso manual más — el depósito tiene que confirmar explícitamente, no es "gratis" desde el rechazo.

### Opción B — Reingreso automático a stock en el momento del rechazo

Descartada: crea un movimiento de stock (`InventoryMovement`) por mercadería que todavía está físicamente en tránsito, no en el depósito — inconsistente con el principio ya vigente en el proyecto de que "el stock nunca se modifica manualmente, siempre por movimiento real" (si el movimiento no representa un hecho físico ya ocurrido, es un dato falso desde el día uno).

**Recomendación: Opción A.** Impacto en stock: nuevo tipo de `InventoryMovement` ("devolución" o "cuarentena"), fuera de alcance de implementar en esta ADR. Impacto en cuenta corriente: nota de crédito opcional, disparada por decisión humana en `confirmarRecepcionDevolucion`, no automática.

---

## 7. Proof of Delivery

### Opción A — Reusar el pipeline de evidencia existente (ADR-005) para todo, incluida la firma

Campos: `fecha`/`hora` (ya existen, `creadoEn`), `receptor: { nombre: string, documento?: string, contactId?: string | null }` (nuevo — **corrección de la revisión 2026-09-09:** `nombre`/`documento` quedan como texto libre, tal como estaba, porque hoy `Client` no modela contactos múltiples (ver pregunta abierta) — pero el tipo YA incluye `contactId` opcional y explícitamente nulo desde el día uno, sin usarlo todavía. El motivo es puramente de migración: si `contactId` no existe en el tipo hoy y se agrega después, cada POD ya guardado en ese momento queda sin ese campo (`undefined` implícito, no `null` explícito) — indistinguible de "no se guardó nunca" vs. "se guardó antes de que existiera el campo". Con `contactId` presente y `null` desde el día uno, un POD viejo dice explícitamente "no tenía contacto asociado" y un POD nuevo (una vez que Clientes tenga contactos) dice "sí lo tiene, es este" — sin ambigüedad ni migración de datos), `firmaEvidenciaId: string` (la firma se captura como imagen — canvas rasterizado a PNG en el momento — y sube por el MISMO flujo de `uploads.service.ts` que las fotos, sin infraestructura nueva), `imagenesIds: string[]` (ya existe como `evidenciaIds`, se **extiende a toda entrega, no solo rechazos** — hallazgo #6), `ubicacion?: { lat, lng, precision }` (nuevo, opcional — depende de permiso de geolocalización del dispositivo, nunca bloqueante si el usuario lo niega), `observaciones?: string` (nuevo, texto libre), `timestampDispositivo: string` + `timestampServidor: string` (los dos — ver justificación abajo).

**Por qué los dos timestamps:** `timestampDispositivo` es el reloj del celular en el momento del evento — puede estar mal configurado o adelantado/atrasado, pero es la única fuente de "cuándo pasó realmente" si el evento se generó offline y se sincronizó después. `timestampServidor` es cuándo el sistema lo recibió — nunca se ajusta a mano, es la fuente de verdad para ordenar eventos entre sí y para facturación/SLA. Se guardan los dos, nunca se descarta ninguno; la UI muestra el de dispositivo como "hora de la entrega" y el de servidor solo en contextos de auditoría.

**Ventaja:** cero infraestructura nueva — la firma es "una foto más" para el pipeline que ya existe y ya cumple ADR-005. **Costo:** una firma rasterizada a PNG pesa más que el trazo vectorial que la generó (unos KB vs. unos bytes) — irrelevante contra el límite de 10MB/archivo ya vigente.

### Opción B — Firma como path vectorial (array de puntos), campo propio

Guarda el trazo (`{x, y, t}[]`) en vez de una imagen — permite replay/verificación de la firma (velocidad del trazo, presión si el dispositivo la reporta) y pesa una fracción de una imagen. **Descartada por ahora:** no hay ningún requisito de negocio planteado que necesite replay/verificación forense de la firma — es una capacidad más sofisticada de lo que este ADR pide resolver, y agregarla implica un formato de dato nuevo (no reutiliza `uploads.service.ts`) sin un caso de uso concreto que la justifique hoy. Si en el futuro se necesita, es un campo aditivo, no rompe lo de la Opción A.

**Recomendación: Opción A** — reutilizar ADR-005 sin extender su infraestructura, y evolucionar a la Opción B solo si aparece un requisito real de verificación de firma.

---

## 8. Qué se rompe — plan de migración incremental

1. **`Delivery` → `Entrega`**: el tipo actual se renombra conceptualmente y pasa a colgar de `Parada` en vez de ser la raíz. Mientras no exista `Parada`/`Viaje` implementados, `Entrega` puede seguir viviendo como hoy (una Parada implícita de 1 pedido) — es un paso intermedio válido, no hace falta implementar los 4 niveles de una sola vez.
2. **`OrderStatus`**: se agrega el campo comercial nuevo (`comercial`, escribible) y las 2 proyecciones de solo lectura (`logisticoResumen` derivado de la Parada, `estadoFinancieroResumen` derivado de comprobantes) **sin borrar `status` todavía** — convive un tiempo, con `status` congelado (deprecado, de solo lectura, ya no se escribe desde código nuevo) hasta que toda la UI que lo lee (`OrdersPage`, `OrderDetailPanel`, exports) migre a los ejes nuevos. Recién ahí se borra el campo viejo.
3. **`puedeTransicionar`/`DELIVERY_TRANSITIONS`**: se extiende (no se reemplaza) para cubrir `Parada.status` con los 11 valores nuevos — el mapa y la función son el mismo patrón, más grande.
4. **Botón "Avanzar estado" manual de `OrdersPage.tsx:171`**: deja de tener sentido una vez que el estado logístico se deriva de la Parada — se retira cuando el eje logístico esté migrado (paso 2), no antes (mientras conviva con el modelo viejo, sigue siendo la única forma de mover `Order.status`).
5. **`RegistrarEntregaModal.tsx`**: hoy asume 1 Delivery = 1 pedido. Migrar a Parada multi-pedido exige que este modal pase a operar sobre "todas las Entregas de la Parada", cambio de UI no trivial — es el punto de mayor esfuerzo de toda la migración, y candidato a ser su propia tanda separada del resto de este ADR.

---

## Decisiones — APROBADAS 2026-09-09 (con correcciones aplicadas en cada sección)

1. **Tres ejes de estado (comercial/logístico/financiero) como columnas/proyecciones de `Order`, con el logístico derivado de la Parada.** — **Aprobado: Opción A (sección 1), con corrección: el eje financiero es una proyección de solo lectura derivada de comprobantes, NUNCA un campo escribible** (ver sección 1).
2. **Jerarquía Viaje → Parada → Entrega → Línea, con Parada multi-pedido.** — **Aprobado: Opción A (sección 2), sin alternativa.** La alternativa mono-pedido-por-parada que este ADR ofrecía en su primera versión queda **descartada explícitamente**: un cliente recibe habitualmente más de un pedido en la misma visita, y el sentido de la Parada es registrar "llegué al cliente" una sola vez — con parada mono-pedido, "llegué y estaba cerrado" se registraría N veces (una por pedido) y esas N podrían divergir entre sí, exactamente la inconsistencia que la Parada existe para evitar.
3. **`allowedTransitions` explícito en cada respuesta de la API, en vez de que el cliente reimplemente/comparta la función de transición.** — **Aprobado: Opción A (sección 3), con corrección: `allowedTransitions` es un array de objetos `{ transicion, permitida, motivo? }`, no un array de strings** — ver sección 3.
4. **Idempotencia por clave UUID generada por el cliente.** — **Aprobado: Opción A (sección 4), con corrección: la clave se genera al formar la INTENCIÓN (abrir el modal / componer la acción), no al confirmar/enviar** — y ante un duplicado el servidor devuelve el resultado original, nunca un error — ver sección 4.
5. **Catálogo de motivos por empresa (código + descripción) con fallback "Otro" + texto.** — **Aprobado: Opción A (sección 5), con corrección: cada motivo lleva además `requiereEvidencia` y `disparaLogisticaInversa`, y los textos bajo "Otro" quedan consultables para revisión periódica** — ver sección 5.
6. **Logística inversa en 2 pasos (marcar "en retorno" al rechazar, mover stock solo al confirmar recepción física).** — **Aprobado: Opción A (sección 6), con corrección: lo rechazado existe como cantidad propia (`cantidadEnTransitoDeRetorno`), no solo como metadato; y la diferencia entre lo declarado por el chofer y lo contado en depósito es un caso normal del endpoint de recepción, no una excepción** — ver sección 6.
7. **POD reusa el pipeline de evidencia (ADR-005) para la firma (imagen, no vectorial).** — **Aprobado: Opción A (sección 7), con corrección: `receptor` incluye `contactId?: string | null` desde el día uno (sin usarlo todavía), para no migrar registros de POD el día que Clientes gane contactos múltiples** — ver sección 7.
8. **Pregunta que este ADR no puede resolver por su cuenta (contradice implícitamente el modelo de `Client` actual, sin ADR propio) — sigue abierta, no se resuelve con esta aprobación:** el `receptor` de la sección 7 asume que un cliente puede tener más de un contacto/receptor posible — hoy `ClientAccount` no modela contactos múltiples (`AUDIT_15` no lo revisó a fondo, es de otro dominio). Si `receptor` debe resolver contra un contacto tipado del cliente en vez de texto libre, hace falta una decisión de modelado de `Client` que este ADR no cubre — el campo `contactId` de la corrección #7 deja la puerta abierta sin forzar la decisión ahora.
