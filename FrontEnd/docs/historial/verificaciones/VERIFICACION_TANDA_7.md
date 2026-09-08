# Verificación Tanda 7 — Tablero y consultas agregadas

Cierre a nivel de código (gates automáticos verificados: `tsc -b --force` 0 errores, `npm run lint` 0 errores/1 warning preexistente, `npm run build` exitoso, smoke script `scripts/smoke/tanda-7.smoke.mjs` con 17 verificaciones OK, autorrevisión de diff sin `any`/cálculos agregados en cliente/query keys sin `empresaId`). Ningún punto de esta lista se verificó todavía en navegador.

## Alcance implementado

1. **Módulo `Money`** (`src/shared/utils/money.ts`, ADR-008) — usado SOLO en las secciones nuevas del tablero (cuentas por cobrar vencidas). Los campos monetarios existentes del dominio (`Order.totalAmount`, `CashTransaction`, `ClientAccount`, `AgingBucketAggregate`) siguen en `number` — migrarlos es trabajo futuro, explícitamente fuera de esta tanda.
2. **Ventas por ZONA** (no "por sucursal" — `Order` no tiene `branchId`, ver decisión abajo) y **pedidos del período por estado** — agregados nuevos, derivados server-side del store real de `orders.service.ts` (`getOrdersSnapshotForAggregation`), nunca calculados en un componente.
3. **Cuentas por cobrar vencidas** — reusa `getOverdueClientsPage#aggregates.byBucket` (ya calculado en `clients.service.ts`, sin tocar ese archivo), envuelto en `Money`.
4. **Alertas (ADR-007)** — campanita real en el header (reemplaza el botón de notificaciones hardcodeado con badge "3" fijo que existía antes), summary + detalle paginado por CURSOR (primer endpoint del proyecto que pagina así).
5. **Deep link a pedidos pendientes de preparación** — tarjeta en el Dashboard que linkea a `/pedidos?status=pending`.

## Decisión de modelado documentada

`Order` es de alcance EMPRESA (confirmado en `AUDIT_5_SCOPE_EMPRESA_SUCURSAL.md`) y no tiene ningún campo de sucursal — agrupar "ventas por sucursal" tal como pide el prompt maestro no es viable sin agregar `branchId` a `Order` (cambio de modelo de datos que excede esta tanda). Se implementó **"ventas por zona"** en su lugar, usando `Order.clientZone` (dato geográfico real que sí existe) — la sección del Dashboard y el código lo llaman explícitamente "por zona", no "por sucursal", para no fingir un dato que no está.

## Checklist para Leandro (navegador)

1. **Campanita de alertas (header, arriba a la derecha):** debería mostrar un badge numérico con la cantidad de alertas NO LEÍDAS (el mock trae varias, algunas leídas y otras no — contar manualmente contra `src/data/mock/alerts.data.ts` si hace falta confirmar el número exacto).
2. Hacer click en la campanita: debe abrir un panel con una lista de alertas (ícono de camión para "transferencia retrasada", ícono de paquete para "producto por vencer"), la más reciente primero.
3. Click en "Cargar más" (si hay más de 5 alertas): debe traer las siguientes sin repetir ninguna de las ya mostradas, y el botón debe desaparecer cuando no quedan más.
4. Click en el check de una alerta no leída: debe marcarla como leída (el ítem se atenúa visualmente) y el badge del botón principal debe bajar en 1.
5. Cerrar el panel (click afuera o Escape) y volver a abrirlo: debe recargar la primera página desde cero (no mantener el scroll/estado de la sesión anterior — es intencional, cada apertura es una consulta nueva).
6. Ir al **Dashboard** (`/dashboard`): debajo de la tabla de "Pedidos recientes" debe aparecer una sección nueva con 4 tarjetas: "Ventas por zona" (lista de zonas con su total y cantidad de pedidos), "Pedidos por estado" (conteo por cada estado), "Cuentas por cobrar vencidas" (montos formateados en ARS/USD si corresponde, vía el nuevo formateador `Money`), y una tarjeta clickeable "Pedidos pendientes de preparación" con un número grande.
7. Click en la tarjeta de "Pedidos pendientes de preparación": debe navegar a `/pedidos` con el filtro de estado ya en "Pendiente" (confirmar visualmente que el filtro de estado del listado de Pedidos ya viene aplicado, sin tener que elegirlo a mano).
8. Confirmar que las secciones existentes del Dashboard (KPIs, gráfico de ventas, top productos, pedidos recientes) siguen funcionando exactamente igual que antes — esta tanda no las tocó.

## Explícitamente fuera de alcance (no implementado, no es un bug)

- Migrar `Order`/`CashTransaction`/`ClientAccount`/`PurchaseOrder` de `number` a `Money` — migración de dominio completa, pendiente.
- "Ventas por sucursal" real (requiere agregar `branchId` a `Order` — decisión de modelado, no tomada en esta tanda).
- Cualquier ruta nueva para alertas — hoy es solo un panel/dropdown en el header, sin una pantalla dedicada.
