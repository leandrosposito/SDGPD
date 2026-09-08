# Verificación en navegador — Tanda B (conexión de funciones huérfanas)

Checklist para Leandro. Conecta 3 funciones que hasta ahora solo ejercitaba su propio smoke script (Tandas 5/8 de la corrida anterior) a componentes reales: `deriveOrderFulfillmentStatus`/`resolveOrderClient` en `OrderDetailPanel`, `isRechazoTotal` en `DeliveryHistoryModal`.

**Importante sobre el mock:** los 6 pedidos del mock tienen `cantidadEntregada: 0` en TODAS sus líneas (confirmado por grep, ningún dato de partida tiene entregas parciales), y no hay ningún remito precargado (`deliveryNotesStore` arranca vacío, los remitos solo existen en runtime). Esto significa que, apenas abrís la app, vas a ver el estado "por defecto" en los 2 puntos nuevos — para ver los casos interesantes (parcial/completo, rechazo total) hace falta generar los datos primero, con pasos explícitos abajo.

## 1. Estado de cumplimiento del pedido (badge "Entrega")

1. Ir a Pedidos, abrir el detalle de cualquier pedido (ej. PED-00391).
2. En la metadata del panel, confirmar que aparece un campo "Entrega (ADR-001)" con un badge — **resultado esperado hoy:** "Sin entregar" (neutral), porque ningún pedido del mock tiene entregas todavía.
3. En la tabla de líneas del pedido, confirmar 2 columnas nuevas: "Entregado" y "Pendiente" — hoy deberían mostrar `0` y la cantidad pedida completa, respectivamente, en todas las filas.
4. Ir a Logística, buscar una entrega cuyo `orderId` corresponda a ese mismo pedido, y usar "Registrar entrega" para cargar una entrega PARCIAL (menos que el total pedido en al menos una línea).
5. Volver a Pedidos, reabrir el detalle del mismo pedido: el badge "Entrega" debe pasar a "Entrega parcial" (warning), y las columnas "Entregado"/"Pendiente" deben reflejar lo cargado.
6. Repetir el registro de entrega hasta cubrir el 100% de todas las líneas: el badge debe pasar a "Entregado" (success).

## 2. Cuenta del cliente real (no el snapshot)

1. En el mismo detalle de pedido, confirmar que aparece un campo "Cuenta del cliente (estado actual)" con el saldo actual y el límite de crédito — estos valores deben ser los del cliente REAL (`ClientAccount`, tabla de Clientes), no el `clientName` congelado que ya mostraba el panel antes.
2. Elegir un pedido cuyo cliente tenga `currentBalance > creditLimit` en el Directorio de Clientes (ej. cualquiera marcado como excedido) y confirmar que aparece el badge rojo "Excede limite" al lado del saldo.
3. Elegir un pedido cuyo cliente esté al día y confirmar que NO aparece ese badge.

## 3. Badge "Rechazo total" en remitos

1. Desde Logística, "Registrar entrega" sobre alguna entrega, cargando una línea con `cantidadRechazada` igual a toda la cantidad ofrecida (rechazo total de esa línea) — si el pedido tiene una sola línea, esto ya alcanza para que el remito completo sea "rechazo total".
2. Abrir el historial de esa entrega (ícono/botón de historial en `DeliveriesTable`) y confirmar que el remito recién creado muestra el badge rojo "Rechazo total" al lado de su entrada en la sección "Remitos".
3. Registrar una segunda entrega donde SÍ se entregue algo (rechazo parcial o ninguno) y confirmar que ESE remito no muestra el badge.

## Qué NO cubre este checklist

Nada de estilos/responsive fue revisado a mano. El catálogo de clientes se trae con `useCachedQuery` (mismo patrón que `CreateOrderModal`) — no se verificó en navegador que el catálogo se comparta de verdad entre ambos componentes sin duplicar el fetch (debería, por `queryName` compartido, pero es una confirmación pendiente si hace falta certeza total).
