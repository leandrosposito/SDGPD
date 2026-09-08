# Verificación funcional manual — Tanda 3a (módulo Pedidos migrado)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración completa de `orders` (Pedidos) a la capa `api/` +
`usePagedQuery` + `httpClient` — primer módulo migrado que no tenía service previo
(antes leía el mock directo en un `useState`). Verifica en particular que las
mutaciones (crear pedido, cambiar estado) ya no se pierdan al navegar a otra pantalla,
que es el bug concreto que esta tanda resuelve (ítem 8 de `docs/PENDIENTES.md`).

**Servidor de desarrollo:** al final de esta sesión te doy el puerto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar.

**Cómo cambiar de escenario:** igual que en los checklists anteriores — editá
`FrontEnd/.env.local` (copiando el bloque de `.env.local.ejemplo-verificacion` que
corresponda), reiniciá el servidor, recargá.

---

### 1. El listado de Pedidos carga, pagina, busca y ordena

- Andá a **Pedidos** (`/pedidos`).
- **Qué deberías ver:** la tabla carga con los 6 pedidos del mock, y aparecen los
  controles de paginación abajo (`<Pagination>`, nuevo en esta tanda — antes no
  existía, la tabla mostraba todo sin paginar).
- En el campo "Cliente" (arriba, el buscador), tipeá `esquina` — después de un
  instante (debounce de 300ms) debería quedar solo "Almacen La Esquina" (2 pedidos en
  el mock). Borrá el texto — vuelven los 6.
- **Si no pasa esto:** si la tabla no carga nada o queda en el estado de carga para
  siempre, revisá la consola por errores.

### 2. Los filtros por estado funcionan y se resuelven server-side

- En el `<select>` de "Estado", elegí "Preparando" — debería filtrar a 1 pedido
  (Supermercado Lider, `PED-00390`).
- Probá también "Facturado" (Despensa Los Pinos) y "Cancelado" (Maxikiosco Norte).
- Volvé a "Todos".
- Probá también el filtro de "Vendedor" (elegí "Gonzalez, Maria" — debería quedar con
  los pedidos de esa vendedora) y "Forma de Pago".
- **Qué deberías ver:** cada filtro reduce las filas de la tabla como corresponde, y
  **los KPIs de arriba (Pedidos Hoy, Pendientes, etc.) NO cambian** al filtrar por
  estado — es la misma lógica que ya usan Compras/Logística (los KPIs reflejan
  búsqueda/vendedor/fecha, pero no la faceta de estado que estás togglenado). Antes de
  esta tanda, los KPIs ignoraban TODOS los filtros — ahora sí reaccionan a
  búsqueda/vendedor/forma de pago/fecha (no a estado). Si notás esta diferencia,
  **es un cambio intencional de esta tanda, no un bug** — decime igual si te parece
  mal el criterio.
- **Si no pasa esto:** si el filtro de estado no reduce filas, o si cambia los KPIs,
  avisame.

### 3. Crear un pedido funciona y aparece en el listado

- Click en **"Nuevo Pedido"** (arriba a la derecha).
- Completá los datos mínimos: cliente, vendedor, forma de pago, agregá al menos un
  producto (buscalo o escaneá su SKU/código de barras), dirección/localidad.
- Click en **"Confirmar Pedido"**.
- **Qué deberías ver:** un toast de éxito ("Pedido guardado con exito!"), el modal se
  cierra, y el pedido nuevo aparece en la tabla de Pedidos **sin que hayas recargado
  la página** — con estado "Pendiente" y un número de pedido nuevo (`PED-XXXXX`).
- **Si no pasa esto:** si el modal se cierra pero el pedido no aparece en la tabla, la
  invalidación/`refetch()` no está funcionando — revisar `OrdersPage.tsx#handleCreateOrder`.

### 4. El pedido creado sigue ahí después de navegar a otra pantalla y volver

**Este es el punto central de la tanda — el bug concreto que se arregla.**

- Con el pedido de prueba del punto 3 ya creado y visible en la tabla, navegá a
  **Dashboard** (o cualquier otra pantalla).
- Volvé a **Pedidos**.
- **Qué deberías ver:** el pedido de prueba **sigue en la tabla** — antes de esta
  tanda, como el estado vivía en un `useState` local de `OrdersPage`, cualquier alta
  se perdía al desmontar el componente (navegar afuera y volver reiniciaba todo desde
  el mock original). Ahora el pedido persiste porque vive en el store del service
  (`orders.service.ts`), no en el componente.
- **Si no pasa esto:** si el pedido de prueba desapareció al volver, el fix no
  funcionó — es el hallazgo más importante para reportar si falla.

### 5. Cambiar de sucursal filtra los pedidos correctamente

- Con la tabla de Pedidos cargada, anotá cuántas filas hay.
- Cambiá de sucursal con el selector del Header.
- **Qué deberías ver:** el listado de Pedidos **no cambia en absoluto** — mismas
  filas, sin ningún parpadeo de recarga. Es el comportamiento correcto (no un bug):
  un pedido es de la empresa, no de una sucursal — confirmado explícitamente antes de
  implementar esta tanda (a diferencia de lo que se había asumido originalmente).
- **Si no pasa esto** (el listado SÍ cambia o se recarga al cambiar de sucursal): eso
  sería inesperado, avisame.

### 6. Los cambios de estado de un pedido funcionan

- Hacé click en **"Ver detalle"** de un pedido en estado "Pendiente".
- En el panel de detalle, buscá el botón para avanzar de estado (debería decir algo
  como "Marcar como Preparando" o similar, según el estado actual).
- Click en ese botón.
- **Qué deberías ver:** el estado del pedido cambia (tanto en el panel de detalle
  como, al cerrar el panel, en la fila de la tabla) — sigue la secuencia Pendiente →
  Preparando → Despachado → Entregado → Facturado. Un pedido "Facturado" no debería
  tener botón para seguir avanzando (es el último estado del flujo).
- Probá también **"Cancelar"** sobre un pedido en cualquier estado (no solo
  "Pendiente") — debería funcionar siempre, sin restricción (a diferencia de las
  Órdenes de Compra de Compras, que sí restringen desde qué estados se puede
  cancelar).
- **Si no pasa esto:** si el botón de avanzar estado no hace nada, o si "Cancelar" no
  funciona desde algún estado, anotá desde cuál.

---

## Tabla de resultados

**Sin ejecutar, 04/09/2026.** El commit de esta tanda se autorizó en base a `tsc -b`,
`npm run lint` y `npm run build` limpios más el análisis de código, sin correr este
checklist en el navegador. El checklist sigue vigente y ejecutable tal cual está
escrito arriba cuando se retome — ninguno de los 6 puntos, incluido el punto 4 (el
objetivo central de esta tanda: que un pedido creado sobreviva a navegar afuera y
volver, lo que cierra el ítem 8 de `PENDIENTES.md`), fue confirmado todavía.

| Punto | Resultado | Notas |
|---|---|---|
| 1. Listado carga/pagina/busca | No ejecutado | |
| 2. Filtros por estado, server-side, KPIs no cambian con estado | No ejecutado | |
| 3. Crear pedido funciona y aparece en el listado | No ejecutado | |
| 4. Pedido creado sobrevive a navegar afuera y volver | No ejecutado | Objetivo central de la tanda — el cierre del ítem 8 de `PENDIENTES.md` es por código (store en memoria del service), no por verificación funcional confirmada. |
| 5. Cambiar de sucursal no afecta el listado | No ejecutado | |
| 6. Cambios de estado (avanzar y cancelar) funcionan | No ejecutado | |
