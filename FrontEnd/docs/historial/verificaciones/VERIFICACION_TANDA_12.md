# Verificación Tanda 12 — Ajustes de pedidos, inventario, clientes y proveedores

**Fecha:** 2026-09-10. Seis tareas independientes. Tres tareas del pedido original de la sesión ya estaban resueltas de una sesión anterior (Tanda 11, `post-tanda11`, verificado contra el código real antes de arrancar: `reprogramDelivery` libera la Parada, número de pedido correlativo por empresa, patente única normalizada) — no se tocaron de nuevo.

## Qué verificar en el navegador

1. **cancelOrder rechaza delivered/invoiced/cancelled server-side.** `/pedidos` — el mock semilla ya trae ejemplos de cada caso: `ord-006` (`PED-00386`) está `delivered`, `ord-004` (`PED-00388`) está `invoiced`, `ord-005` (`PED-00387`) ya está `cancelled`. Abrir cualquiera de los tres — el botón "Cancelar" no debe aparecer (ya lo ocultaba el cliente antes de esta tanda). Sobre `ord-001`/`ord-002`/`ord-003` (pending/preparing/dispatched) el botón sí debe aparecer y cancelar debe funcionar normalmente.
2. **deleteProduct: baja lógica.** `/inventario`, editar cualquier producto → "Eliminar" → el texto de confirmación ahora dice "¿Marcar este producto como Inactivo?" (no "no se puede deshacer"). Confirmar — el producto NO debe desaparecer de "Stock Actual": debe seguir en la tabla con el badge "INACTIVO". Editarlo de nuevo y cambiar "Estado" a "Activo" — debe volver a aparecer como "ACTIVO".
3. **CreateClientModal persiste Lista de Precios y Condición de Venta.** `/clientes`, crear un cliente nuevo, tab "Configuración Comercial" → elegir "Distribuidor" y "Cuenta Corriente" (valores distintos de los defaults). Guardar, volver a abrir ese mismo cliente para editar — esos dos campos deben seguir mostrando "Distribuidor"/"Cuenta Corriente" (antes se perdían en silencio al guardar).
4. **CUIT único en proveedores.** `/proveedores`, "Nuevo Proveedor" con un CUIT que ya existe en el mock (ej. `30-54321678-9`) — debe rechazarse con "Ya existe un proveedor con ese CUIT." Con espacios/guiones distintos pero los mismos dígitos (ej. `30546789...` según corresponda) también debe rechazarse — la comparación ignora el formato.
5. **Botón Editar en proveedores.** `/proveedores`, click en cualquier fila para abrir el detalle — debe verse un botón "Editar" junto a "Nueva OC" en el encabezado del panel. Click — abre el modal de edición con los datos precargados; guardar debe actualizar el proveedor sin recargar la página.
6. **isExpiringSoon corregido.** `/inventario`, abrir el detalle de lotes de un producto que tenga lotes vencidos (badge "VENCIDO") — no deben aparecer también marcados como "Próximo a vencer" en ningún caso (antes del fix esto no era observable en esta pantalla porque el orden de los `if` lo enmascaraba, pero confirma que el dato de fondo es correcto).

## Qué NO se verificó (queda para Leandro)

- **Concurrencia real** de las nuevas validaciones server-side (CUIT único, estado de cancelOrder) — no hay forma de simular dos usuarios en simultáneo desde el navegador.
- **Los 9 campos "fantasma" restantes de `CreateClientModal`** (ver `docs/PENDIENTES.md` ítem 15) — quedaron documentados, no conectados; no hay nada que verificar ahí porque el comportamiento (se descartan al guardar) no cambió.

## Hallazgos de esta sesión

- **Cerrado — `docs/PENDIENTES.md` ítem 1** (botón Editar en proveedores, documentado desde antes de esta sesión).
- **Nuevo — `docs/PENDIENTES.md` ítem 15**, Severidad Media: al auditar `CreateClientModal.tsx` para conectar `listaPrecios`/`condicionVenta` se encontraron otros 9 campos con el mismo bug (`nombreFantasia`, `condicionIva`, `email`, `googleMapsLink`, `isEntregaIgualFiscal`, `direccionEntrega`, `referenciasEntrega`, `categoria`, `notas`, `isActive`) — capturados en la UI, descartados en silencio al guardar. Fuera de alcance de lo pedido explícitamente, documentado en vez de tocado por iniciativa propia.

## Decisiones tomadas sin consultar (regla 2.9)

- **CreateClientModal: persistir en vez de quitar los campos.** La tarea daba las dos opciones; se eligió persistir porque los campos ya tenían una UI real e intencional (`ClientCommercialTab`) y el costo de conectarlos es chico (mismo patrón plano que `zone`/`sellerName`, sin entidad de dominio nueva detrás).
- **CUIT: normaliza solo para comparar, no lo guardado** (a diferencia de la patente de vehículos, Tanda 11, que normaliza ambos) — el CUIT de este proyecto se muestra siempre con guiones en el mock semilla y no se pidió forzar el formato de entrada del usuario.
- **`invalid-status-for-cancel` como reason nuevo y distinto de `terminal-status`** — ver el comentario en `orders.service.ts`: son conceptos distintos (uno es "sin siguiente paso en el flujo", el otro es "prohibido cancelar aunque tenga siguiente paso").
