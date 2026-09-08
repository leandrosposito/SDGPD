# Verificación Tanda 5 — IDs tipados y relación orderId/clientId hacia orders

**Fecha:** 2026-09-07. Implementa ADR-006 (branded types: `OrderId`, `BranchId`, `OrderLineId`, `ClientId`) y resuelve el hallazgo ALTO #1 de `AUDIT_4_IDS_RELACIONES.md` (Order sin relación tipada hacia ClientAccount) para el dominio `orders`.

Gates automáticos (todos verificados antes de este documento): `tsc -b --force` 0 errores, `npm run lint` 0 errores (1 warning preexistente sin cambios), `npm run build` exitoso, smoke script `scripts/smoke/tanda-5.smoke.mjs` con sus 12 verificaciones en OK.

## Qué verificar en el navegador

1. **Abrir "Nuevo Pedido" (Pedidos → botón de alta).** El campo "Cliente" ya no es un `<input>` de texto libre: debe mostrar un buscador ("Buscar por razón social o CUIT...").
2. **Tipear parte de un nombre de cliente real** (ej. "Almacen", "Kiosco", "Distribuidora") — debe aparecer una lista desplegable con hasta 8 resultados que matchean por nombre o CUIT.
3. **Elegir un cliente de la lista** — el campo debe pasar a mostrar el nombre y CUIT del cliente elegido (chip/tarjeta), con un botón "Cambiar" para volver a buscar.
4. **Cliente con deuda:** buscar y elegir "Kiosco El Paso (Excedido)" (cli-003) — debe aparecer la alerta roja "Cliente Excedido" (antes dependía de que el usuario tipeara la palabra "excedido"/"deuda"; ahora se deriva de `currentBalance > creditLimit` del cliente real).
5. **Cliente sin deuda:** elegir cualquier otro cliente (ej. "Almacen La Esquina") — la alerta NO debe aparecer.
6. **Botón "Confirmar Pedido" deshabilitado** si no se eligió cliente, aunque ya haya productos cargados (antes solo dependía de `items.length`).
7. **Crear el pedido completo** (cliente + al menos un producto) y confirmar — el pedido debe guardarse sin error, y si se abre su detalle (`OrderDetailPanel`) debe mostrar el nombre del cliente real elegido.
8. **Botón "Cambiar"** en la sección de cliente ya elegido — debe volver al buscador vacío, permitiendo elegir otro cliente (sin perder el resto del formulario ya cargado).
9. **Deep-link de Compras con sucursal inválida** (difícil de forzar desde la UI sin editar la URL a mano): pegar en la barra de direcciones, estando en `/compras`, algo como `?producto=inv-001&sucursal=sucursal-invalida` — la pantalla NO debe romperse ni mostrar una pantalla en blanco; en la consola del navegador debe aparecer un `console.warn` indicando que el valor de sucursal es inválido, y el modal de "Generar OC" debe abrirse sin sucursal preseleccionada (o comportarse como si no hubiera parámetro).
10. **Filtro de sucursal en Compras (`?oc_branch=` u otro nombre de filtro con prefijo, ver Tanda 4) con un valor inválido pegado a mano en la URL** — mismo criterio que el punto 9: no debe romper el listado, debe descartarse silenciosamente con warning en consola.

## Qué NO se tocó en esta tanda (fuera de alcance, documentado a propósito)

- `Delivery.orderId`/`CashTransaction` no ganaron ninguna relación tipada nueva — solo `Order.clientId`.
- `sellerName` sigue siendo texto libre (pregunta abierta de A4, no resuelta acá).
- No se migró `ProductId`/`DeliveryId` (ADR-006 los deja para cuando la Tanda 8 los necesite).
