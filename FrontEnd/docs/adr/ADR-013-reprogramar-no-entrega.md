# ADR-013 — Reprogramar y "entrega no realizada" frente a la Parada

**Estado:** Decidido, sin consultar (regla 2.9 del protocolo — Leandro no fue consultado antes de tomarla). **Fecha:** 2026-09-10. Cierra un gap real que ni ADR-010 ni ADR-011 resolvían explícitamente: qué le pasa a una `Parada` (`Stop`, Tanda 10B) cuando una de sus `Delivery` se reprograma, y cómo se registra que un chofer llegó a una dirección y no pudo entregar.

## Problema

Tanda 9 (ADR-010 sección 4) implementó `reprogramDelivery`: mueve una `Delivery` de vuelta a `CREADO` con fecha nueva. Tanda 10B (ADR-011) agregó `Stop.deliveryIds` como el único mecanismo real de "esta entrega está asignada a este viaje" — `assignDeliveriesToStop` lo escribe, y la detección de conflicto de concurrencia (`findTripContainingDelivery`) lo lee para decidir si una entrega ya está tomada por otro viaje.

Estas dos piezas nunca se conectaron: `reprogramDelivery` solo toca `deliveriesStore`, nunca mira si la entrega está en el `Stop.deliveryIds` de algún viaje. Consecuencia real: reprogramar una entrega que ya estaba asignada a una Parada la deja "fantasma" — el viaje sigue creyendo que la lleva (aparece en `TripDetailPanel`, cuenta para `capacidadUsada`), pero la entrega ya tiene otra fecha y en la práctica no va a salir con ese viaje. Y no existe ningún flujo para registrar "el chofer llegó a la dirección y no pudo entregar" — `StopStatus` ya tiene el valor `'NoVisitada'` desde Tanda 10B, pero nada lo escribe.

## Opción elegida

### 1. `reprogramDelivery` libera la entrega de cualquier Parada que la tuviera asignada

Se agrega `releaseDeliveryFromTrip(deliveryId)` en `trips.service.ts` (servidor a servidor, mismo patrón que `getDeliveryById` — sin pasar por `httpClient`, sin duplicar latencia simulada): busca el viaje que tiene esa entrega en algún `Stop.deliveryIds` (reusa `findTripContainingDelivery`, ya existente), la saca de ahí, y **recalcula `capacidadUsada`/`sobrecargado`** del viaje (nunca queda un número stale) e incrementa `version` (la Parada cambió, cualquier operación de asignación en curso contra la versión vieja debe fallar por control optimista, mismo criterio que el resto de ADR-011 sección 3).

`deliveries.service.ts#reprogramDelivery` la llama después de aplicar su propio cambio. Esto crea una dependencia de import en la dirección `deliveries.service.ts → trips.service.ts`, **sumada** a la que ya existe en sentido contrario (`trips.service.ts → deliveries.service.ts`, para `getDeliveryById`/`transitionDelivery`/etc., Tanda 10B) — mismo patrón ya aceptado y verificado en Tanda 9 para `orders.service.ts ↔ deliveries.service.ts` (AUDIT_15, hallazgo ALTO resuelto): seguro porque ninguno de los dos lados consume el import a nivel de módulo, solo dentro del cuerpo de una función invocada más tarde.

**"Devolverla a la cola de pendientes de asignación" no necesita una cola nueva.** Una vez que `reprogramDelivery` deja la `Delivery` en `CREADO` (ya lo hacía) y la saca de `Stop.deliveryIds` (este ADR), la entrega vuelve a cumplir las dos condiciones que `CreateTripModal`/`getDeliveryIdsMatchingFilter` ya usan para considerarla candidata: `status === 'CREADO'` y ningún viaje la referencia. No hace falta un flag ni una tabla nueva — es el mismo mecanismo, aplicado correctamente.

**Si la Parada queda sin ninguna entrega**, no se borra automáticamente del viaje — sigue existiendo con `deliveryIds: []`, visible en `TripDetailPanel` para que el operador decida (reordenar, dejarla, etc.). Auto-eliminar la Parada es una decisión de UX que nadie pidió y que complica la numeración de `orden` sin necesidad.

### 2. `reprogramDelivery` pasa a usar el catálogo de motivos ('reprogramacion'), no texto libre

Mismo patrón que `registrarEntrega`/'rechazo' (ADR-010 sección 5): `ReprogramDeliveryInput` cambia `motivo: string` por `motivoCodigo: string` + `motivoOtroTexto?: string` + un nuevo parámetro `motivoTipo: MotivoTipo` (para que la misma función sirva tanto a `ReprogramarModal` como al flujo de "entrega no realizada" de la sección 3, cada uno validando contra su propio catálogo — `'reprogramacion'` o `'no-entrega'`). El texto se resuelve **server-side** contra el catálogo real, nunca confiando en lo que mande el cliente — `ReprogramacionEvent` gana un campo `motivoCodigo?: string` opcional (mismo criterio que `DeliveryNoteLine.motivoCodigo`/`motivoRechazo`: el código queda consultable, el texto resuelto sigue siendo lo que ya pintaba `DeliveryHistoryModal.tsx`, sin tocar esa pantalla).

### 3. "Entrega no realizada" es una acción sobre la Parada, no sobre la Delivery aislada — reusa `reprogramDelivery`, no lo duplica

`ADR-010` ya modela la Parada como "una visita física" y `ADR-011` ya le dio un estado `NoVisitada`. Una "entrega no realizada" es, en los hechos, el chofer llegando a esa dirección y no pudiendo dejar nada — corresponde a la Parada, no a una Delivery suelta (si la Parada tiene 3 pedidos del mismo cliente y el local está cerrado, ninguno de los 3 se entregó, no uno). Por eso el disparador vive en `TripDetailPanel.tsx`, por Parada, no en `DeliveriesTable.tsx`/`LogisticsPage.tsx` (que sigue siendo el lugar de `ReprogramarModal`, una reprogramación "administrativa" sin relación a un viaje en curso).

Nueva función `markStopNoVisitada` en `trips.service.ts`: por cada `deliveryId` de la Parada, llama a `reprogramDelivery` (motivoTipo `'no-entrega'`, con sub-clave de idempotencia `${idempotencyKey}-${deliveryId}` — mismo criterio que `registerPod` con `-finalizar`) — lo que además dispara la sección 1 de este ADR y libera cada entrega de la Parada automáticamente, sin lógica duplicada. Después marca `Stop.estado = 'NoVisitada'`. **No se agrega un campo de motivo propio en `Stop`**: el motivo real queda en el evento de reprogramación de cada `Delivery` (`Delivery.reprogramaciones`, consultable vía `DeliveryHistoryModal`) — duplicarlo en la Parada sería una segunda fuente de verdad para el mismo hecho.

`disparaLogisticaInversa`/`requiereEvidencia` de los motivos `'no-entrega'` se tratan igual que `'reprogramacion'`: **ninguno dispara logística inversa** (la mercadería nunca salió del camión — no hay nada "volviendo" del cliente, a diferencia del rechazo de ADR-010 sección 6) — el campo existe en el catálogo por consistencia de tipo, pero queda en `false` para todos los ítems sembrados de estos dos tipos.

## Alternativas descartadas

1. **Un campo `motivoNoVisita`/`motivoNoVisitaTexto` en `Stop`.** Descartada: duplica el motivo que ya queda en `Delivery.reprogramaciones` — dos lugares para el mismo hecho es exactamente la migración a medias que el protocolo prohíbe (sección 6, trampa #2).
2. **"Entrega no realizada" como estado nuevo de `Delivery`** (en vez de reusar `REPROGRAMADO`/`reprogramDelivery`). Descartada: `DeliveryStatus` ya tiene 5 valores bien definidos (ADR-002) y el resultado real de "no se pudo entregar hoy" siempre termina siendo "reprogramar para otro intento" — no es un estado terminal distinto, es la misma transición con un motivo distinto. Agregar un sexto estado duplicaría la máquina de transiciones sin necesidad.
3. **Auto-eliminar la Parada cuando se queda sin entregas.** Descartada arriba (sección 1) — decisión de UX sin pedido explícito, complica `orden`.

## Qué se rompe si se cambia después

- Si en el futuro se implementa la jerarquía completa de ADR-010 sección 2 (`Entrega` como entidad propia colgando de `Parada`, no `Delivery` plana), `Stop.deliveryIds` deja de ser el mecanismo de asignación — `releaseDeliveryFromTrip`/`markStopNoVisitada` deberían migrar a operar sobre esa relación nueva, mismo criterio que el resto del modelo interino de Tanda 10B.
- Si se decide que "entrega no realizada" SÍ debe disparar logística inversa en algún caso futuro (ej. mercadería perecedera que no puede volver a subir al camión en buen estado), es un cambio de dato en el catálogo (`disparaLogisticaInversa: true` en el ítem correspondiente), no de código — el flag ya existe y ya se lee, solo hay que decidir para qué motivo puntual aplicaría.
