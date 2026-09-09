# Verificación Tanda 9 — Modelo Logístico Base

**Fecha:** 2026-09-09. Implementa ADR-010 (Aceptado, con correcciones 2026-09-09) y ADR-011 (Aceptado, con correcciones 2026-09-09) — solo el modelo y el circuito de datos: NO incluye vehículos, choferes, viajes, motor de asignación, mapas ni POD (esos son la tanda siguiente, ADR-011). Alcance: módulo Logística (`/logistica`) + panel de detalle de Pedidos (`/pedidos`).

## Qué verificar en el navegador

1. **Crear una entrega desde un pedido (hallazgo A15#1 — lo más importante de esta tanda).** Ir a `/pedidos`, abrir el detalle de un pedido con `comercial = Confirmado` (cualquiera de los 6 del mock salvo el cancelado). En la nueva sección "Entregas" del panel, click en "Nueva entrega". Se abre un modal: elegir sucursal, fecha, horario estimado, zona, prioridad y monto a cobrar, confirmar. Debe aparecer un toast de éxito con el código de la entrega nueva (`del-...`) y la tabla de "Entregas" del panel debe listarla en estado "Creada" sin recargar la página.

2. **La entrega nueva aparece en Logística.** Ir a `/logistica`, filtrar por la sucursal/fecha elegidos en el paso 1 — la entrega recién creada debe aparecer en la tabla, con las acciones habilitadas según su estado ("En ruta" disponible, "Registrar entrega" y "Reprogramar" no).

3. **Un pedido no confirmado no puede generar entrega.** Si hay algún pedido con `comercial` distinto de `Confirmado` (ej. el cancelado del mock), el botón "Nueva entrega" en su panel debe estar deshabilitado, con un tooltip explicando por qué.

4. **Estado logístico/financiero del pedido, sincronizado (hallazgo A15#3).** En el panel de detalle de un pedido con al menos una entrega, verificar los dos badges nuevos ("Estado logístico" / "Estado financiero"). Marcar esa entrega "En ruta" desde `/logistica`, volver al panel del pedido (cerrar y reabrir, o esperar el refetch) — el badge "Estado logístico" debe reflejar "En Ruta" sin que nadie haya tocado el pedido directamente: no hay un botón que lo actualice a mano, se lee siempre de la entrega real.

5. **Motivo de rechazo por catálogo, no texto libre (ADR-010 sección 5).** Sobre una entrega "En Ruta", abrir "Registrar entrega", cargar una cantidad en "Rechazar ahora" — debe aparecer un desplegable con motivos reales (no un campo de texto libre). Elegir "Otro (especificar)" — debe aparecer un campo de texto obligatorio al lado; intentar confirmar sin completarlo debe mostrar un error.

6. **Reintentar/doble-click no duplica (idempotencia, ADR-010 sección 4).** Sobre una entrega "Creada", click en "En ruta" dos veces seguidas muy rápido (antes de que el toast aparezca) — no debe haber dos eventos de historial ni un error extraño; a lo sumo un segundo click sin efecto porque la entrega ya cambió de estado. (La verificación completa de la idempotencia real — mismo `idempotencyKey` devolviendo el mismo resultado guardado — está cubierta por el smoke script `tanda-9.smoke.mjs` y por lectura de código, no hay forma de simular un reintento de red real desde el navegador sin herramientas adicionales.)

7. **Motivo explicado en cada transición no disponible.** Sobre una entrega "Finalizada" o "Cancelada", no debe haber ningún botón de acción salvo "Ver historial" (igual que Tanda 8) — la ausencia de botones ahora viene de `allowedTransitions` en la respuesta del servidor, no de una regla calculada en el componente.

## Qué NO se verificó (queda para Leandro)

- `DeliveryHistoryModal` (panel de historial) no cambió en esta tanda: sigue mostrando solo la cantidad de líneas y el badge "Rechazo total" de cada remito, no el texto de motivo resuelto por línea — el dato (`motivoCodigo`/`motivoRechazo` ya resuelto) queda guardado y accesible en `deliveryNotesStore`, pero no hay una vista que lo despliegue línea por línea todavía. No es una regresión de esta tanda (el modal nunca mostró ese detalle), se anota como hallazgo.
- El corte real de idempotencia ante un reintento de red (respuesta duplicada del mismo `idempotencyKey` con latencia/fallos simulados de `httpClient`) — cubierto por smoke script y lectura de código (`withIdempotency`), no ejercitado a mano con DevTools throttling en esta sesión.
- La proyección financiera (`estadoFinancieroResumen`) es un stub explícito sobre el `status` legado (no existe dominio de Facturación todavía) — el valor mostrado hoy solo puede ser "Facturado" o "Sin facturar", nunca "Cobrado" ni "Con nota de crédito" (esos dos valores del tipo están definidos pero ningún dato del mock los produce todavía).

## Qué queda fuera de esta tanda (documentado, no implementado)

- Vehículos, choferes, viajes, motor de asignación, mapas y POD (ADR-011) — la tanda siguiente.
- Reverse logística completa (movimiento de stock por devolución) — `cantidadEnTransitoDeRetorno` y el resto del modelo de ADR-010 sección 6 quedan definidos en el ADR pero no implementados: esta tanda solo agrega el catálogo de motivos con el flag `disparaLogisticaInversa`, no el circuito de devolución en sí.
- Migración de `OrdersPage`/exports a leer `comercial`/las proyecciones derivadas en vez del `status` legado — `advanceOrderStatus` y su botón siguen escribiendo `status` sin cambios (ADR-010 sección 8, punto 4: se retira recién cuando toda la UI que lo lee haya migrado).
- Pantalla de revisión periódica de motivos "Otro" — el texto queda guardado en cada línea del remito (`motivoCodigo`/`motivoRechazo`), pero no hay una vista que liste "todos los Otro pendientes de revisar".
- Vocabulario de 11 estados de Parada (ADR-010 sección 2) — esta tanda usa un vocabulario interino de 5+1 valores (`OrderLogisticoResumen`) derivado directo de `Delivery.status`, documentado como reemplazable cuando Parada exista.
