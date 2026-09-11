# Verificación Tanda 13 — Precondiciones de `markStopNoVisitada` (enmienda ADR-013)

**Fecha:** 2026-09-11. Dos tareas nuevas del pedido de esta sesión; las otras cinco (`cancelOrder`, `deleteProduct`, `CreateClientModal`, CUIT único + botón Editar, `isExpiringSoon`) ya estaban resueltas de la sesión anterior (Tanda 12, `post-tanda12`, verificado contra el código real antes de arrancar) — no se tocaron de nuevo.

## Qué verificar en el navegador

1. **El botón "Entrega no realizada" se deshabilita según el estado de la Parada/viaje.** `/logistica` → viajes:
   - `trip-001` (Planificado, ambas paradas Pendiente): abrir el detalle — el botón "Entrega no realizada" de **las dos** paradas (`stop-001`, `stop-002`) debe aparecer deshabilitado, con tooltip "El viaje todavía no salió (o ya se rindió/canceló)...".
   - `trip-002` (EnTransito): la parada `stop-003` (ya `Visitada`) debe tener el botón deshabilitado con tooltip "Esta parada ya no está Pendiente...". La parada `stop-004` (`Pendiente`, con `del-005` en estado no terminal) debe tener el botón **habilitado**.
2. **Rechazo server-side aunque se fuerce el click (defensa en profundidad).** Con el botón de `stop-004` habilitado, completar y confirmar `NoEntregaModal` — debe marcar la parada como no visitada exitosamente (toast de éxito) y `stop-004` debe pasar a mostrar el badge "NoVisitada". Verificar que la entrega `del-005` quedó reprogramada (abrir su historial desde `/pedidos` o el módulo de entregas — `CREADO` con fecha nueva) y que ya no aparece en `Stop.deliveryIds` de `trip-002`.
3. **No marca la Parada si alguna reprogramación falla (caso no reproducible directo en UI sin manipular el mock).** No hay forma de forzar que `reprogramDelivery` falle desde la UI con los datos semilla actuales (siempre tiene éxito si pasó las precondiciones) — este camino quedó cubierto por `scripts/smoke/tanda-13.smoke.mjs` (chequeo puro de las precondiciones) y lectura de código (`trips.service.ts#markStopNoVisitada`, el `if (resultadosPorEntrega.some(...))` antes de tocar `Stop.estado`). Si en algún momento se quiere verificar en vivo, haría falta un delivery ya en estado terminal agregado a mano a una Parada `Pendiente` del mock — no se hizo porque ensuciaría el dataset semilla sin necesidad.
4. **Trazabilidad `tripId`/`stopId` en `ReprogramacionEvent`.** Después del paso 2, abrir el historial de `del-005` (`DeliveryHistoryModal` o el detalle de la entrega) — el evento de reprogramación debe estar asociado a `trip-002`/`stop-004` (no visible como columna en la UI actual — confirmar leyendo la respuesta de red en devtools, o agregar temporalmente un `console.log`, ya que no hay una pantalla dedicada a mostrar estos dos campos; son metadata de auditoría, no un dato pensado para mostrarse en esta tanda). Comparar contra una reprogramación hecha desde `ReprogramarModal.tsx` (cualquier entrega desde `/pedidos` o `/logistica` sin pasar por una Parada) — esa debe tener `tripId`/`stopId` ausentes.

## Qué NO se verificó (queda para Leandro)

- El caso de éxito-parcial-pero-falla-total (`reason: 'reprogram-failed'`) no tiene un camino reproducible desde la UI con el dataset semilla actual — ver punto 3 arriba, cubierto solo por smoke script + lectura de código.
- Concurrencia real de las nuevas precondiciones (dos usuarios intentando marcar la misma Parada en simultáneo) — no hay forma de simular esto desde el navegador.

## Hallazgos de esta sesión

- **Cerrado — HALLAZGO ALTO en `markStopNoVisitada`** (reportado por Leandro, no encontrado por auditoría propia esta vez): la función no validaba nada antes de reprogramar — se podía ejecutar sobre una Parada `'Visitada'` (con POD) o un viaje `'Planificado'`/`'Rendido'`/`'Cancelado'`, y devolvía `success: true` marcando `NoVisitada` aunque todas las reprogramaciones fallaran. Ver la enmienda 2026-09-11 de `docs/adr/ADR-013-reprogramar-no-entrega.md` para el detalle completo de la corrección.
- **Cerrado — `ReprogramacionEvent` sin trazabilidad `tripId`/`stopId`** (reportado por Leandro): agregados como campos opcionales, poblados solo cuando la reprogramación nace de `markStopNoVisitada`.

## Decisiones tomadas sin consultar (regla 2.9)

- **Predicado compartido en `shared/utils/stopVisitEligibility.ts`** en vez de duplicar el chequeo en `trips.service.ts` y `TripDetailPanel.tsx` por separado — mismo criterio que `canCancel`/`has-active-deliveries` de tandas anteriores: una sola fuente de la regla, el cliente nunca es la única barrera.
- **Todo-o-nada en el marcado de la Parada, sin rollback de las entregas que sí tuvieron éxito dentro del mismo intento fallido** — no existe un mecanismo de transacción real en este mock; agregar uno solo para este caso de borde no fue pedido y las mutaciones ya aplicadas se tratan como hechos físicos consumados (mismo criterio que `registrarEntrega`/`registerPod`).
- **`'reprogram-failed'` como `MarkStopNoVisitadaReason` nuevo y distinto de las 4 precondiciones** — las precondiciones se pueden re-chequear sin efectos secundarios (nunca tocan un store); `'reprogram-failed'` solo puede conocerse después de haber intentado reprogramar de verdad, así que necesita su propio motivo en vez de reusar `'no-deliveries'` o inventar un motivo genérico.
