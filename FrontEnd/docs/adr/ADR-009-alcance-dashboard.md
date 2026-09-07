# ADR-009 — Alcance del dashboard (empresa vs. sucursal)

**Estado:** Decidido. **Fecha:** 2026-09-07. Resuelve la pregunta abierta #2 de `AUDIT_5_SCOPE_EMPRESA_SUCURSAL.md` ("¿el Dashboard es agregado de TODA la empresa o de la sucursal activa?"), dejada explícitamente sin cerrar en la corrida completa.

## Problema

El tablero (`DashboardPage` + `DashboardAggregatesSection`, Tanda 7 de la corrida completa) tiene 3 tarjetas de agregados server-side (ventas por zona, pedidos por estado del período, cuentas por cobrar vencidas) sin ningún filtro de sucursal — siempre agregado de TODA la empresa, sin que el usuario pueda elegir, y sin que la pantalla diga en ningún lado de qué alcance son los números que muestra.

**Restricción real del modelo de datos, no negociable sin abrir una tanda aparte:** `Order` no tiene `branchId` (alcance EMPRESA, decisión ya cerrada — ver `AUDIT_5_SCOPE_EMPRESA_SUCURSAL.md`, "qué está bien"). `ClientAccount`/facturas tampoco tienen ninguna relación con sucursal, ni siquiera indirecta. Esto significa que "filtrar por sucursal" no puede significar lo mismo para las 3 tarjetas — hay que decidir, tarjeta por tarjeta, qué es honesto mostrar.

## Opción elegida

### El alcance lo elige el usuario, con la sucursal activa como default

- `branchId` es un parámetro **OPCIONAL** en los endpoints agregados del dashboard (`getDashboardAggregates`, y por consistencia de contrato también en `getOverdueTotalsInMoney`, aunque para esta última — ver abajo — el parámetro no cambia el resultado). Ausente/`null` = toda la empresa.
- El filtro vive en la URL (`?branch=<id>` o `?branch=all`), igual que cualquier otro filtro de listado del proyecto (Tanda 4, A13) — la URL es la única fuente de verdad de la elección explícita del usuario en esta pantalla.
- **Si no hay `branch` en la URL, el dashboard sigue la sucursal activa del selector global** (`useSessionStore#activeBranchId`) — no un default fijo ni "toda la empresa" por sorpresa. El usuario puede, desde el propio tablero, elegir un alcance DISTINTO del selector global (útil para comparar sin cambiar el contexto de trabajo del resto de la app) sin que eso mueva el selector global.
- `branchId` (o su ausencia explícita, "todas las sucursales") **forma parte de la query key** del cache — `undefined` (URL sin filtro, sigue al selector global) y `null`/`'all'` (el usuario eligió expresamente "todas las sucursales") son estados distintos y ambos entran en la key, nunca colapsados en una sola entrada de cache ambigua.

### Qué significa "filtrar por sucursal" para cada tarjeta — decidido tarjeta por tarjeta, nunca genérico

1. **Ventas por zona / Pedidos por estado del período** (derivan de `Order`, que no tiene `branchId`): se filtran por sucursal **vía `Delivery`**, no agregando un campo nuevo a `Order`. Un pedido "pertenece" a la sucursal X si existe al menos una `Delivery` con `orderId` igual al del pedido y `branchId === X` — es una relación real ya existente en el modelo (`Delivery.orderId` + `Delivery.branchId`, ambos tipados desde la Tanda 5/8), no una inferencia inventada. Si el pedido tiene entregas desde más de una sucursal (reintentos, redespacho), cuenta para cada una — es lo honesto: genuinamente se cumplió (parcialmente) desde ambas.
2. **Cuentas por cobrar vencidas** (deriva de `ClientAccount`/facturas, sin ninguna relación con sucursal en el modelo, ni directa ni vía `Delivery`): **queda EMPRESA-ONLY siempre**, sin excepción. El parámetro `branchId` se acepta en la firma por consistencia de contrato pero el cálculo lo ignora — documentado explícitamente en el código, no un olvido. La tarjeta en pantalla lo dice de forma fija ("Toda la empresa"), sin importar qué sucursal esté seleccionada en el resto del tablero.

### Nunca dos fuentes de verdad — regla de UI

El encabezado del tablero muestra siempre el alcance activo elegido (sucursal X / toda la empresa). Además, **cada tarjeta individual muestra su propio alcance real** — no alcanza con un rótulo global si una tarjeta (cuentas por cobrar) no puede honrar ese alcance. Ninguna tarjeta puede mostrar un número sin que quede claro, en la propia tarjeta, a qué recorte corresponde.

### Reconciliación — por qué la suma de los recortes por sucursal NO da el total de empresa (adenda 2026-09-08, verificado contra el mock real, no hipotético)

Esto no es un caso teórico: `ord-004` en el mock tiene 3 `Delivery` — dos desde `branch-001` (`del-004`, `del-010`) y una desde `branch-003` (`del-016`). Confirmado también por el smoke script (`scripts/smoke/adr-009.smoke.mjs`, casos "ord-004 (multi-sucursal) aparece en branch-001" y "...en branch-002" — mismo mecanismo, aplica igual a la combinación real branch-001/branch-003 del mock).

**Dos distorsiones reales y aceptadas, ninguna es un bug:**

1. **Doble conteo en pedidos multi-sucursal.** El `totalAmount` de `ord-004` entra COMPLETO al agregado de `branch-001` Y COMPLETO al de `branch-003` — no se prorratea. Sumar "Ventas por zona" de todas las sucursales una por una da un total MAYOR que "Ventas por zona" visto con el filtro en "Toda la empresa" (que cuenta `ord-004` una sola vez). Es la consecuencia directa y ya aceptada de la decisión de la sección anterior ("si el pedido tiene entregas desde más de una sucursal... cuenta para cada una").
2. **Pedidos sin ninguna entrega desaparecen de TODAS las vistas por sucursal.** `ord-003` (sin ninguna `Delivery` asociada, confirmado en el mock y por el smoke script: "ord-003 (sin entregas) no aparece en ningun filtro por sucursal") sí aparece en la vista "Toda la empresa" (que no filtra, usa el snapshot completo) pero en NINGUNA vista de sucursal puntual. Sumar "Pedidos por estado" de todas las sucursales una por una da un total MENOR que "Toda la empresa" — los pedidos todavía sin despachar desde ningún depósito quedan fuera de cualquier recorte por sucursal, visibles solo en el agregado de empresa.

**Por qué se acepta así, sin cambiar el comportamiento:** ambas distorsiones son la consecuencia honesta de que la relación pedido↔sucursal es real (vía `Delivery`), no inventada — un pedido que génuinamente se despachó desde dos depósitos genuinamente cuenta para los dos; un pedido que todavía no se despachó desde ningún lado genuinamente no "pertenece" a ninguno todavía. Forzar que sumen (ej. prorrateando `ord-004` a mitades, o inventándole una sucursal a `ord-003`) sería menos honesto que la distorsión misma. La UI debe advertirlo, no ocultarlo: cuando hay un filtro de sucursal activo, la sección muestra una nota aclarando que estos números no van a coincidir con "Toda la empresa" sumados sucursal por sucursal, por las dos razones de arriba.

**Corrección a la sección "Qué se rompe si se cambia" (más abajo):** la afirmación original de que "cada pedido del mock tiene sus entregas en una sola sucursal" era incorrecta — no se verificó contra los datos reales al escribirla. Corregida en esa sección.

## Alternativas descartadas

1. **Agregar `branchId` a `Order`.** Es la forma "más limpia" de resolver esto en abstracto, pero es un cambio de modelo de datos que toca el mapper/DTO/mock/formulario de creación de pedidos — una tanda aparte, no lo que pide este ADR. La relación vía `Delivery` da el mismo resultado honesto sin ese costo.
2. **Dashboard fijo a la sucursal activa, sin selector propio.** Descartada explícitamente por el pedido — el usuario quiere poder elegir, no que el tablero solo seguir al selector global sin posibilidad de mirar otra sucursal o la empresa completa sin cambiar de contexto.
3. **Dashboard fijo a "toda la empresa", sin filtro.** Es el comportamiento actual — no resuelve la pregunta abierta, y el pedido es explícito: "lo elige el usuario".
4. **Forzar que las 3 tarjetas respondan a `branchId` de alguna forma, aunque sea aproximada** (ej. "cuentas por cobrar" filtradas por la zona del cliente, tratando zona como proxy de sucursal). Descartada: `zone` y `branchId` son conceptos distintos (uno geográfico, declarado por el cliente; el otro, el depósito real que atiende) — usar uno como proxy del otro sería exactamente el tipo de aproximación que el ADR de IDs tipados (ADR-006) y esta misma decisión buscan evitar. Mejor ser explícito en que esa tarjeta no puede filtrarse, que mentir con un filtro aproximado.

## Qué se rompe si se cambia después

- Si en algún momento se agrega `branchId` real a `Order` (la alternativa #1 descartada), el filtro vía `Delivery` para ventas/pedidos debería migrarse a usar el campo directo — más simple y sin el caso de borde de "pedido con entregas en más de una sucursal" (que SÍ ocurre en el mock real, `ord-004` — ver "Reconciliación" arriba, corrige una afirmación anterior de este mismo documento que decía lo contrario sin haberlo verificado).
- Si se decide en el futuro modelar `ClientAccount`/facturas con relación a sucursal (ej. "sucursal de venta"), la tarjeta de cuentas por cobrar deja de ser la única excepción "empresa-only" — hay que sacar esa restricción explícitamente del código y de esta decisión, no dejarla como código muerto.
- Cualquier tarjeta nueva que se agregue al dashboard en el futuro debe declarar explícitamente, desde el día uno, si puede honrar el filtro de sucursal o no — no asumir que "todo lo del dashboard se filtra igual" (exactamente el error que este ADR corrige).
