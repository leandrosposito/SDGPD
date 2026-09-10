# ADR-014 — Número de pedido correlativo por empresa

**Estado:** Decidido, sin consultar (regla 2.9 del protocolo). **Fecha:** 2026-09-10.

## Problema

`orders.service.ts#nextOrderNumber` genera `PED-${Date.now().toString().slice(-5)}` — los últimos 5 dígitos del timestamp en milisegundos. No es correlativo (no cuenta pedidos, deriva del reloj), no es por empresa (no existe el concepto en la función), y puede colisionar: dos pedidos creados con los mismos últimos 5 dígitos de `Date.now()` (se repiten cada ~100 segundos) generarían el mismo número. El mock semilla (`orders.data.ts`) ya usa el formato `PED-XXXXX` (5 dígitos, `PED-00391`..`PED-00386`) sin que nada en el código lo derive de ahí — son strings sueltos.

## Opción elegida

### Contador correlativo en memoria, `Map<empresaId, number>`, formato `PED-XXXXXX` (6 dígitos)

`orders.service.ts` mantiene `const orderNumberCounters = new Map<string, number>()` — mismo criterio de "estado de servidor mock en una variable de módulo" que `deliveriesStore`/`tripsStore`/`vehiclesStore` ya usan. `nextOrderNumber(empresaId: string)`:

1. Si `empresaId` no tiene contador todavía, lo **siembra** con el máximo sufijo numérico encontrado en `ORDERS_MOCK_DATA` (391 hoy) — así los pedidos nuevos nunca chocan con los del mock semilla, sin importar cuántos dígitos tenía el formato viejo.
2. Incrementa y guarda.
3. Devuelve `PED-${next.toString().padStart(6, '0')}` — `PED-000392` para el primer pedido nuevo.

**Limitación honesta del mock, documentada en el código:** `Order` no tiene campo `empresaId` (no existe en `order.types.ts`, y este ADR no lo agrega — sería una tanda de modelo de datos aparte). El mock de este proyecto es de una sola empresa (`company-001`) en todos los módulos ya migrados (mismo criterio que `suppliers.service.ts`, `vehicles.service.ts`, etc.: "el contrato ya exige `empresaId`, el mock de hoy no tiene más de una para filtrar de verdad"). El `Map` queda listo para multi-empresa real el día que `Order` tenga el campo — hoy, en la práctica, solo existe una clave.

**Concurrencia (honesto sobre mock vs. backend real):** en este mock, JavaScript es de un solo hilo — dos llamadas a `createOrder` nunca se intercalan a mitad de la lectura-incremento-escritura del contador, así que no hay condición de carrera posible aquí. Un backend real con múltiples instancias SÍ la tiene, y necesitaría una secuencia atómica de base de datos (ej. `SEQUENCE` de Postgres por empresa, o una fila con `SELECT ... FOR UPDATE`) para garantizar que dos pedidos concurrentes nunca reciban el mismo número — se deja anotado en el código como lo que un backend real tiene que resolver, no como algo que este mock simule (no hay forma honesta de simular una condición de carrera real en un runtime de un solo hilo).

## Alternativas descartadas

1. **UUID o `Date.now()` con más dígitos.** Resuelve la colisión pero no "correlativo" — el pedido explícitamente pide un número que cuente pedidos, no un identificador opaco (eso ya lo tiene, es `OrderId`/`ord-...`).
2. **Derivar el número del `.length` de `ORDERS_MOCK_DATA` en cada alta** (`PED-${(store.length + 1).toString().padStart(6,'0')}`). Descartada: se rompe apenas se cancela/borra un pedido (el conteo baja, el próximo número podría repetir uno ya emitido) — un correlativo real nunca reutiliza un número ya asignado, cuenta emisiones, no filas vivas.
3. **Pedir el número al servidor antes de crear el pedido** (`POST /orders/next-number` → usar el número devuelto). Descartada por la misma razón que ADR-010 sección 4 descartó el equivalente para idempotencia: una ida y vuelta de red extra antes de poder intentar la operación real, sin necesidad — `createOrder` ya es una única operación atómica en el mock, no hay motivo para partirla en dos.

## Qué se rompe si se cambia después

- Si `Order` gana `empresaId` real (día que exista multi-empresa de verdad), el `Map` ya está preparado — no hace falta cambiar la firma de `nextOrderNumber`, solo que `createOrder` empiece a pasar el `empresaId` real de cada pedido en vez de siempre el mismo.
- Si se migra a un backend real, el `Map` en memoria se reemplaza por la secuencia atómica de la base de datos — el contrato de `createOrder` (recibe `empresaId`, devuelve un `Order` con `orderNumber` ya asignado) no cambia, solo la implementación interna.
