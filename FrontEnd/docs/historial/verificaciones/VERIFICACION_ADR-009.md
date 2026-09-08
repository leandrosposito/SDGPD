# Verificación en navegador — ADR-009 (alcance del dashboard elegido por el usuario)

Checklist para Leandro. Agrega un selector de alcance (sucursal / toda la empresa) a la sección de agregados del tablero (`DashboardAggregatesSection`), con la URL como fuente de verdad y fallback a la sucursal activa del selector global.

**Sobre el mock:** cada uno de los 6 pedidos (`ord-001`..`ord-006`) tiene entregas en MÁS DE UNA sucursal (reintentos/redespacho ya estaban en los datos de logística) — así que filtrar por sucursal SÍ cambia qué pedidos entran en "Ventas por zona"/"Pedidos por estado", no es un caso vacío:

| Sucursal | Pedidos que incluye | Pedidos que excluye |
|---|---|---|
| Sucursal Centro (`branch-001`) | ord-001, 002, 004, 005, 006 | ord-003 |
| Sucursal Norte (`branch-002`) | ord-001, 002, 003, 005, 006 | ord-004 |
| Sucursal Sur (`branch-003`) | ord-001, 003, 004, 005 | ord-002, ord-006 |

## 1. Selector de alcance y encabezado

1. Ir al Dashboard. En la sección de agregados (debajo de "Pedidos recientes"), confirmar que aparece un encabezado "Agregados — Mostrando: <algo>" junto a un `<select>` con ícono de edificio.
2. Sin haber tocado nunca el selector, confirmar que el alcance mostrado coincide con la sucursal activa del selector global (el de la cabecera de la app) — si el selector global dice "Sucursal Centro", acá también debería decir "Sucursal Centro".
3. Cambiar la sucursal activa desde el selector GLOBAL (cabecera): confirmar que el alcance del dashboard también cambia (porque no hay `?branch=` propio en la URL todavía, sigue al global).

## 2. Elegir un alcance propio, distinto del selector global

1. En el `<select>` del dashboard, elegir una sucursal DISTINTA de la activa globalmente (ej. si el selector global está en "Sucursal Centro", elegir "Sucursal Norte" acá).
2. Confirmar que la URL cambia a algo como `?branch=branch-002` (no exactamente ese nombre de param necesariamente, pero un parámetro de sucursal debería aparecer).
3. Confirmar que el selector GLOBAL de la cabecera **NO** cambió — sigue en "Sucursal Centro". El dashboard mira otra cosa sin mover el contexto de trabajo del resto de la app.
4. Confirmar que "Ventas por zona" y "Pedidos por estado" cambiaron sus números (comparar contra el paso 1 — según la tabla de arriba, Sucursal Norte excluye `ord-004`, así que si ese pedido aportaba una zona/estado único, debería notarse la diferencia).
5. Confirmar que "Cuentas por cobrar vencidas" **NO cambió** y sigue mostrando el sub-rótulo fijo "Toda la empresa (no se puede filtrar por sucursal)".

## 3. "Toda la empresa" explícito

1. Elegir la opción "Toda la empresa" en el `<select>`.
2. Confirmar que la URL queda con algo como `?branch=all`.
3. Confirmar que los 3 sub-rótulos de las tarjetas dicen "Toda la empresa" (las 2 dinámicas + la fija de Cuentas por Cobrar, ahora coincidiendo).
4. Confirmar que "Ventas por zona"/"Pedidos por estado" ahora incluyen los 6 pedidos del mock (el conjunto más amplio posible).

## 4. F5 mantiene la elección

1. Con `?branch=branch-002` (o cualquier sucursal específica) en la URL, recargar la página completa (F5).
2. Confirmar que el dashboard vuelve a mostrar exactamente esa sucursal, no la activa global ni "toda la empresa" — la URL es la fuente de verdad.
3. Repetir con `?branch=all` en la URL — F5 debe mantener "toda la empresa", no volver a la sucursal activa.

## 5. Volver a "seguir sucursal activa"

1. Con un alcance propio ya elegido (paso 2), elegir la opción "Seguir sucursal activa" del `<select>`.
2. Confirmar que el parámetro de sucursal desaparece de la URL.
3. Confirmar que el alcance mostrado vuelve a coincidir con el selector global.

## Qué NO cubre este checklist

Nada de estilos/responsive del `<select>` fue revisado a mano. No se verificó el caso de una sesión sin ninguna sucursal activa (⁠`activeBranchId: null`⁠, solo posible mientras la sesión está cargando) — el comportamiento esperado por código es caer a "toda la empresa" sin romper el render, pero no se probó visualmente ese instante exacto de carga.
