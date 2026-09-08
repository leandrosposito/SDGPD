# Verificación Tanda 8 — Entregas (parcial, seguimiento, reprogramación, rechazo)

**Fecha:** 2026-09-07. Implementa ADR-001, ADR-002, ADR-003 y ADR-005 completos (`FrontEnd/docs/adr/`). Alcance: módulo Logística (`/logistica`) + `Order`/`OrderItem` (nuevo campo `cantidadEntregada`).

## Qué verificar en el navegador

1. **Entrega en estado "Creada" → "En Ruta".** Abrir `/logistica`, con una entrega en estado "Creada", click en el botón "En ruta". Debe pasar a "En Ruta" (badge azul) y aparecer un toast de confirmación. La lista se refresca sola (no hace falta F5).

2. **Registrar una entrega completa.** Sobre una entrega "En Ruta", click en "Registrar entrega". Se abre un modal con las líneas del pedido asociado (columnas: Pedida / Entregada / Pendiente / Entregar ahora / Rechazar ahora / Motivo). Dejar "Entregar ahora" en el valor por defecto (= pendiente) para todas las líneas y confirmar. La entrega debe pasar a "Finalizada".

3. **Registrar una entrega parcial con rechazo.** Sobre otra entrega "En Ruta", abrir "Registrar entrega", y en una línea cambiar "Entregar ahora" a un valor menor al pendiente y cargar el resto en "Rechazar ahora" con un motivo. Debe aparecer el selector de evidencia ("Adjuntar evidencia") — adjuntar 1-2 imágenes/PDF chicos, esperar a que terminen de subir (ícono de check verde), y confirmar. La entrega pasa a "Finalizada" igual (el rechazo es información de línea, no bloquea el cierre del viaje).

4. **Ver el pedido reflejando la entrega parcial.** Abrir el pedido asociado a la entrega del punto 3 (Pedidos → el mismo `orderId`) y confirmar que la cantidad entregada de esa línea aumentó según lo cargado (no según lo pedido completo).

5. **Intentar subir un archivo inválido.** En el flujo de rechazo, intentar adjuntar un archivo que no sea imagen/PDF, o mayor a 10MB — debe rechazarse con un mensaje claro, sin intentar subirlo.

6. **Reintentar una subida fallida.** Las subidas fallan de forma determinística 1 de cada 8 veces (simulación de ADR-005) — si ves un archivo en rojo con ícono de error, click en el botón de reintentar (flecha circular) junto a ese archivo debe reintentar SOLO ese archivo, sin afectar a los demás ya subidos.

7. **Reprogramar una entrega.** Sobre una entrega "Creada" o "En Ruta", click en "Reprogramar". Cargar una fecha nueva y un motivo (obligatorio — intentar confirmar sin motivo debe mostrar un error), confirmar. La entrega debe volver a aparecer como "Creada" con la fecha nueva.

8. **Ver el historial.** Click en el ícono de historial (reloj) de cualquier entrega. Debe listar las transiciones de estado (con quién y cuándo), y si se reprogramó, la sección de reprogramaciones con motivo/fecha anterior/fecha nueva. Si se registró una entrega, debe aparecer el remito en la sección "Remitos".

9. **Transiciones inválidas no aparecen como botones.** Una entrega "Finalizada" o "Cancelada" no debe mostrar ningún botón de acción salvo "Ver historial" — no hay forma de volver a moverla desde la UI (la máquina de estados lo impide).

10. **Polling (ADR-003).** Con la pestaña de Logística abierta, esperar ~30 segundos con las DevTools abiertas (pestaña Network filtrando por XHR/fetch, o con `VITE_API_DEBUG=true` mirando la consola) — debe verse un nuevo pedido de la misma página/filtros vigentes, sin que el usuario haga nada. Cambiar a otra pestaña del navegador y esperar 30+ segundos: no debe dispararse ningún refetch mientras la pestaña está en segundo plano (`refetchIntervalInBackground: false`).

## Qué NO se verificó (queda para Leandro)

- El caso de "rechazo total" (todas las líneas de un remito rechazadas) no tiene un flujo de UI dedicado distinto — se llega ahí cargando "Rechazar ahora" = pendiente en todas las líneas del modal de registrar entrega. Confirmado por código y por smoke script (`isRechazoTotal`), no ejercitado a mano en el navegador en esta sesión.
- El fallo determinístico de subida (1 de cada 8) es un contador global del módulo — si se abre el modal varias veces en la misma sesión de navegador, el conteo seguido puede hacer que el "1 de cada 8" no caiga exactamente en el archivo que se está probando manualmente. Es un detalle de la simulación, no del comportamiento real esperado.

## Qué queda fuera de esta tanda (documentado, no implementado)

- Corrección/ajuste de una `cantidadEntregada` ya aplicada (ADR-001 menciona "un remito de ajuste" como posibilidad futura, no implementado — hoy un remito solo suma, nunca resta).
- Un hook genérico `useCursorQuery` (la paginación de alertas de Tanda 7 sigue manejando su cursor local, sin abstraer — este proyecto no lo necesitó de nuevo en esta tanda).
- Migración de `Order.quantity`/`cantidadEntregada` a `Money`/enteros de ADR-008 más allá de lo que ya alcanzaba: las cantidades de producto son unidades enteras, no dinero, así que ADR-008 no aplica directamente aquí.
