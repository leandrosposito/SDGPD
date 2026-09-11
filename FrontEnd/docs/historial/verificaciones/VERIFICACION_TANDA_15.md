# Verificación Tanda 15 — Precondiciones adentro de `withIdempotency` (hallazgo MEDIO)

**Fecha:** 2026-09-11. Hallazgo reportado por Leandro: en `markStopNoVisitada`, las precondiciones corrían antes de `withIdempotency`, y `httpClient` reintenta POST (`DEFAULT_RETRIES = 2`) — un reintento con la misma clave después de un éxito podía devolver un motivo de rechazo (leído contra el estado ya mutado por el primer intento) en vez del resultado original, violando el contrato de `ADR-010` sección 4 ("el servidor devuelve el resultado ya guardado de la primera vez — nunca un error").

## Qué cambió

Se movió el cuerpo completo (precondiciones incluidas) adentro del callback de `withIdempotency` en las 4 funciones donde el patrón aparecía:

- `trips.service.ts#markStopNoVisitada` (el caso original reportado).
- `deliveries.service.ts#reprogramDelivery` (mismo patrón: transición inválida/motivo inválido antes de `withIdempotency`).
- `deliveries.service.ts#registrarEntrega` (transición inválida/sin líneas/motivo inválido antes de `withIdempotency`).
- `deliveries.service.ts#createDelivery` (pedido no encontrado/no confirmado antes de `withIdempotency` — el más benigno de los 4: como esta función nunca muta `order.comercial`, el bug concreto no es reproducible hoy, pero es el mismo patrón estructural y quedaba inconsistente con el resto).

Se revisaron TODOS los consumidores de `withIdempotency` del proyecto (`trips.service.ts`, `deliveries.service.ts`, `drivers.service.ts`, `vehicles.service.ts` — **corrección de conteo (Fase D, verificación adversarial D3): son 15 usos en total, no 13** — `grep -c "withIdempotency(idempotencyKey" src/modules/logistics/services/trips.service.ts src/modules/logistics/services/deliveries.service.ts src/shared/api/drivers/drivers.service.ts src/shared/api/vehicles/vehicles.service.ts` da 15): los otros **11** (`createTrip`, `assignDeliveriesToStop`, `transitionTrip`, `registerPod`, `transitionDelivery`, `createDriver`, `updateDriver`, `toggleDriverActivo`, `createVehicle`, `updateVehicle`, `toggleVehicleActivo`) YA tenían las precondiciones adentro — no se tocaron. La lista de nombres siempre fue correcta (11 nombres); el error estaba solo en los dos números de la prosa.

También se corrigió el comentario en `markStopNoVisitada` que afirmaba "revalidar aca o adentro es funcionalmente identico" — esa afirmación es la que estaba mal (ver el comentario nuevo en el código para el razonamiento completo).

## Qué verificar en el navegador

1. **Caso feliz sin cambios.** `/logistica` → viaje `trip-002` (EnTransito) → Parada `stop-004` (Pendiente, con `del-005`) → "Entrega no realizada" → completar y confirmar `NoEntregaModal` → debe tener éxito igual que antes de esta tanda (toast de éxito, `stop-004` pasa a "NoVisitada").
2. **Reintento real con la misma clave no es reproducible desde la UI actual** — `httpClient` reintenta automáticamente solo ante errores de red/timeout/5xx (`isRetryableApiError`), y el mock no tiene forma de forzar esas condiciones desde el navegador sin `VITE_MOCK_FAILURE_RATE` (que además dispara el fallo ANTES de invocar el `mock`, no después de un éxito — no reproduce este caso puntual). Cubierto por `scripts/smoke/tanda-15.smoke.mjs`, que aísla el contrato de `withIdempotency` y demuestra el bug/fix directamente.
3. **Revisar que ningún otro flujo de logística/vehículos/choferes se rompió** — dar de alta un vehículo, un chofer, crear un viaje, asignar entregas a una parada, hacer una transición de viaje: los 4 gates (tsc/lint/build/smoke) ya cubren que compilan y el smoke de idempotencia sigue pasando, pero conviene un paso rápido por cada pantalla para confirmar que no cambió ningún comportamiento visible (esta tanda es un refactor de orden de ejecución, no un cambio de reglas de negocio).

## Qué NO se verificó

- El escenario real que motivó el hallazgo (un reintento de red genuino con la misma `Idempotency-Key`) no es reproducible en el navegador con el mock actual — no hay una forma de inyectar una falla DESPUÉS de que el `mock` ya mutó el store pero ANTES de que la respuesta llegue al cliente (en este mock, mock y cliente son el mismo proceso, no hay ventana de red real). Cubierto por el smoke script, no por click real.
- No se agregó ningún mecanismo para provocar reintentos reales desde la UI (sería una feature de testing nueva, no pedida).

## Decisiones tomadas sin consultar (regla 2.9)

- **Se corrigió también `createDelivery`**, aunque su precondición (`order.comercial !== 'Confirmado'`) no muta el propio store que lee, así que el bug concreto no es explotable hoy con el código actual — se corrigió de todas formas por consistencia estructural con las otras 3 funciones y con el resto de los consumidores de `withIdempotency` (todos con las precondiciones adentro), para no dejar un patrón inconsistente que alguien copie a futuro asumiendo que es el correcto.
- **No se tocó el comentario de diseño de `withIdempotency.ts`** (el archivo en sí) — el bug estaba en cómo lo consumían las 4 funciones, no en el helper compartido, que ya documentaba correctamente su propio contrato.
