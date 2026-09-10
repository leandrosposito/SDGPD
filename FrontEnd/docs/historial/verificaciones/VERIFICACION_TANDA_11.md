# Verificación Tanda 11 — Ajustes de logística y pedidos (ADR-013/ADR-014)

**Fecha:** 2026-09-10. Cinco tareas independientes sobre la base de Tanda 10B: reprogramar libera la Parada, número de pedido correlativo, patente única, override de capacidad en la UI, catálogos `reprogramacion`/`no-entrega` conectados.

## Qué verificar en el navegador

1. **Reprogramar libera la Parada.** Crear un viaje (`/logistica/viajes` → "Nuevo viaje") con al menos una entrega. Ir a `/logistica`, sobre esa misma entrega click "Reprogramar" (el dropdown de motivo ahora tiene opciones reales del catálogo, no un textarea libre — elegir cualquiera, o "Otro" y cargar el texto). Confirmar. Volver al detalle del viaje (`/logistica/viajes`, "Ver detalle") — la parada correspondiente ya no debe listar esa entrega, y "Capacidad usada" debe haber bajado. Abrir "Nuevo viaje" de nuevo — la entrega reprogramada debe volver a aparecer en la lista de candidatas (ya no está "atrapada" en el viaje viejo).
2. **Número de pedido correlativo.** Crear un pedido nuevo (`/pedidos`, "Nuevo Pedido"). El número debe ser `PED-000392` (siguiente al `PED-00391` más alto del mock semilla, ahora con 6 dígitos). Crear un segundo pedido — debe ser `PED-000393`, nunca repetir ni saltear.
3. **Patente única.** `/logistica/vehiculos`, "Nuevo vehículo" — cargar una patente que ya existe (ej. `AB123CD`, o en minúsculas/con espacios: `ab 123 cd`) — debe rechazarse con "Ya existe un vehículo con esa patente." Cargar una patente nueva — debe guardarse en mayúsculas sin espacios sin importar cómo se tipeó.
4. **Override de capacidad en Nuevo viaje.** Crear un vehículo de poca capacidad (ej. 5 bultos) y un viaje intentando asignarle más entregas de las que entran. El modal NO debe cerrarse — pasa a "Revisión de capacidad", listando la(s) parada(s) que no entraron. Cargar un motivo y click "Asignar de todas formas" — la parada debe asignarse igual, y el viaje debe quedar marcado "Sobrecargado" en el listado (`/logistica/viajes`). Alternativa: click "Omitir" — esa parada queda sin esas entregas asignadas (vuelven a estar disponibles).
5. **Catálogo `no-entrega` conectado.** Con un viaje que tenga paradas con entregas, abrir su detalle y click "Entrega no realizada" sobre una parada — el modal pide fecha del próximo intento + motivo (dropdown contra el catálogo real, con "Otro"). Confirmar — la parada debe pasar a estado "NoVisitada" (badge rojo) y quedar sin entregas (se reprogramaron). Verificar en `/logistica` que esas entregas volvieron a "Creada" con la fecha nueva.

## Qué NO se verificó (queda para Leandro)

- **Concurrencia real** de `assignDeliveriesToStop`/override de capacidad — no hay forma de simular dos usuarios en simultáneo desde el navegador; cubierto por lectura de código (mismo mecanismo de Tanda 10B, sin cambios).
- **Reintento de red real** sobre la idempotencia de `reprogramDelivery`/`markStopNoVisitada` — cubierto por `scripts/smoke/tanda-11.smoke.mjs` (indirectamente, vía `withIdempotency` ya testeado en `tanda-10b.smoke.mjs`) y lectura de código, no DevTools throttling.
- **Multi-empresa real** del correlativo de pedidos — el mock de este proyecto es de una sola empresa (ver ADR-014); no hay forma de crear una segunda empresa desde la UI para verificar que cada una tiene su propio contador.

## Hallazgos de Fase D corregidos en esta misma sesión (antes del merge)

- **MEDIO — `CreateTripModal.tsx` casteaba `e.target.value as VehicleId`/`as DriverId` sin validar.** Preexistía desde Tanda 10B (no introducido por esta tanda, encontrado al re-tocar el archivo para el override de capacidad) — el único `as` aceptable del proyecto para tipos branded es el de dentro de `as<Tipo>Id` (ADR-006). Reemplazado por `asVehicleId`/`asDriverId` con guard de string vacío.

## Deuda documentada, no implementada (fuera de alcance de esta tanda)

- `Order.empresaId` sigue sin existir — el correlativo de pedidos está listo para multi-empresa pero el mock de hoy solo ejercita una clave del `Map` (ver ADR-014).
- El motivo de `markStopNoVisitada` no tiene un campo propio en `Stop` — queda en `Delivery.reprogramaciones` de cada entrega (decisión explícita de ADR-013, no una omisión).
