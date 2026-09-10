# Verificación Tanda 10B — Operación Logística (vehículos, choferes, viajes, POD)

**Fecha:** 2026-09-10. Implementa ADR-011 (Aceptado 2026-09-09) sobre el modelo base de Tanda 9 (ADR-010). Alcance: `/logistica/vehiculos`, `/logistica/choferes`, `/logistica/viajes` (nuevos) + conexión de `requiereEvidencia`/`disparaLogisticaInversa` en `/logistica` (ya existente).

## Qué verificar en el navegador

1. **Sidebar.** El ítem "Logística" pasó a llamarse "Entregas" (mismo `/logistica` de siempre). Debajo aparecen tres ítems nuevos: "Viajes", "Vehículos", "Choferes". Navegar a `/logistica/viajes` — solo "Viajes" debe quedar resaltado en el sidebar, no "Entregas" también (si los dos quedan resaltados a la vez, es un bug de `NavLink`).

2. **ABM de Vehículos (`/logistica/vehiculos`).** Debe listar 4 vehículos del mock (uno refrigerado, uno con zona restringida a "Centro"). "Nuevo vehículo" abre un modal con patente/tipo/capacidad (bultos, kg, m³, refrigerado, zonas habilitadas) — dejar la patente vacía y confirmar debe mostrar el error de Zod sin cerrar el modal. Crear uno nuevo y verificar que aparece en la tabla. "Desactivar" sobre un vehículo activo debe cambiar el badge a "Inactivo" sin recargar la página.

3. **ABM de Choferes (`/logistica/choferes`).** Mismo patrón que Vehículos — 3 choferes del mock, alta/edición con Zod, activar/desactivar.

4. **Listado de Viajes (`/logistica/viajes`).** Debe mostrar los 2 viajes del mock (uno Planificado, otro En Tránsito) con vehículo/chofer resueltos por nombre (no el id crudo). Filtrar por estado, fecha, vehículo y chofer — cada filtro debe quedar en la URL (recargar la página con esos query params debe reproducir el mismo filtro). **Cambiar de sucursal activa (selector del header)** — el listado de viajes debe refrescar solo (no debe seguir mostrando los viajes de la sucursal anterior mientras se resuelve la sucursal nueva).

5. **Nuevo viaje.** Desde `/logistica/viajes`, "Nuevo viaje" — elegir vehículo (la capacidad debe verse en el desplegable) y chofer, fecha, y tildar 2-3 entregas de la lista (solo deben aparecer entregas en estado "Creada" de la sucursal activa). Confirmar — debe crear el viaje y mostrar un toast con la capacidad usada (ej. "3/80 bultos"). El viaje nuevo debe aparecer en el listado sin recargar.

6. **Capacidad excedida.** Crear un viaje eligiendo un vehículo de poca capacidad (ej. veh-004, 35 bultos) y tildando más entregas de las que entran — el toast debe avisar que no se pudo asignar esa parada por capacidad (no hay override desde esta UI en esta tanda — el forzar/motivo es un campo del contrato, no expuesto todavía en `CreateTripModal`, ver "Qué NO se verificó").

7. **Detalle de viaje.** Click en "Ver detalle" de un viaje — se abre el panel lateral con vehículo, chofer, fecha, estado, capacidad usada/total, y las paradas en orden con sus entregas. Los botones ↑/↓ de cada parada deben reordenarla (el primero sin botón ↑ habilitado, el último sin botón ↓). Los botones de transición de estado (ej. "Despachar") deben aparecer solo cuando `allowedTransitions` los permite — sobre un viaje Rendido o Cancelado no debe quedar ningún botón de transición.

8. **Posición en vivo.** Abrir el detalle del viaje En Tránsito (trip-002 del mock) — debe mostrarse "lat/lng — hora" como texto (sin mapa, es la decisión explícita de esta tanda). Dejar el panel abierto ~15 segundos: no debería haber ningún parpadeo raro ni error en consola — el polling es cada 12s.

9. **Ver recorrido.** Sobre el viaje En Tránsito, botón "Ver recorrido" — debe mostrar una lista corta de puntos (texto, sin mapa). Sobre un viaje Planificado el botón no debe aparecer.

10. **Registrar POD.** Dentro de una parada, "Registrar POD" — se abre el modal: nombre de receptor (obligatorio), documento (opcional), firma dibujada en el canvas (con el mouse/touch) o, si se usa el link "¿No podés firmar en pantalla?", una imagen en su lugar. "Capturar ubicación" pide permiso de geolocalización — denegarlo NO debe bloquear confirmar. Confirmar sin firma debe mostrar error. Confirmar con firma debe cerrar el modal, mostrar un toast de éxito, y el botón de esa entrega debe pasar a "POD registrado" (deshabilitado) — sin recargar la página.

11. **`requiereEvidencia` conectado (`/logistica`, `RegistrarEntregaModal`).** Sobre una entrega En Ruta, "Registrar entrega" — cargar un rechazo con un motivo que tenga evidencia obligatoria (ej. "Mercadería dañada"). El botón "Confirmar entrega" debe quedar deshabilitado hasta adjuntar al menos un archivo. Con un motivo que NO la exige (ej. "El cliente ya no lo quiere"), debe poder confirmarse sin adjuntar nada.

## Qué NO se verificó (queda para Leandro)

- **Override de capacidad (`forzar`/`motivo`, ADR-011 sección 2, sub-opción A2).** El servicio (`assignDeliveriesToStop`) lo soporta y lo audita (`Trip.overrides`), pero `CreateTripModal.tsx` no expone un botón "Asignar igual" cuando el servidor rechaza por `exceeds-capacity` — hoy ese caso solo se avisa con un toast de error y la parada queda sin esa entrega. Conectar el override a la UI queda como deuda explícita, no implementado.
- **Selección por filtro (`modo: 'filtro'`, ADR-011 sección 1).** `assignDeliveriesToStop` soporta `{modo:'filtro', filtros, excluidos}`, pero `CreateTripModal.tsx` solo usa `modo:'lista'` (checkboxes sobre las ≤100 entregas visibles) — el modo filtro no tiene UI en esta tanda (la tarea no lo pedía para el modal de creación, solo que el servicio lo soportara).
- **Confirmación de recepción de devolución (`confirmarRecepcionDevolucion`, ADR-010 sección 6).** Fuera de alcance explícito de esta tanda — `cantidadEnTransitoDeRetorno` se escribe (ver punto 11 de arriba) pero nada la resuelve a 0 todavía.
- **Concurrencia real (409 granular, ADR-011 sección 3).** No hay forma de simular a mano dos usuarios asignando la misma entrega en simultáneo desde el navegador — verificado por lectura de código (`assignDeliveriesToStop`) y no ejercitado en vivo.
- **Reintento de red real sobre idempotencia** (mismo criterio que Tanda 9): cubierto por `scripts/smoke/tanda-10b.smoke.mjs`, no por DevTools throttling en esta sesión.
- **Documentos impresos (ADR-011 sección 7, hoja de ruta/remitos vía job).** No implementado — fuera del alcance explícito de esta tanda (la tarea no lo pidió).

## Hallazgos de Fase C corregidos en esta misma sesión (antes del merge)

- **ALTO — `branchId`/`empresaId` fuera de `filters` en `getTripsPage`/`getVehiclesPage`/`getDriversPage`.** `usePagedQuery` arma la query key de TanStack Query solo a partir del objeto `filters` (más el `empresaId` que lee de la sesión) — pasar `branchId` como parámetro suelto del `fetchPage` lo dejaba invisible para la key: cambiar de sucursal activa en `/logistica/viajes` no iba a disparar un refetch, iba a servir del caché la página de la sucursal vieja. Corregido: los tres servicios reciben ahora `query: PageQuery<Filters>` con `empresaId`/`branchId` (donde aplica) dentro de `filters`, y las tres páginas pasan la función exportada directo a `usePagedQuery` (antes la envolvían en un arrow inline, que además rompía el requisito de `usePagedQuery` de que `fetchPage` sea una referencia estable — con `.name` vacío, dos listados con `filters` de la misma forma podían compartir la misma query key).
- **ALTO — `registerPod` reportaba éxito sin aclarar si la Delivery se pudo finalizar.** Si la entrega estaba en `CREADO` (nunca salió a `EN_TRANSITO`), `transitionDelivery` a `FINALIZADO` no está permitido — el intento fallaba en silencio y el resultado decía `success: true` sin más. El POD (evidencia física) se sigue guardando igual — es un hecho ya ocurrido, mismo criterio que `propagation-failed` en `registrarEntrega` — pero el resultado ahora incluye `deliveryFinalized: boolean`, y `PodModal.tsx` muestra un toast de advertencia distinto cuando es `false`.
- **MEDIO/gate 5 — `getTripById`/`getTripRoute`/`getPodForDelivery` quedaban exportados sin call-site real.** Conectados: `TripDetailPanel.tsx` ahora usa `getTripById` como fuente autoritativa del detalle (reemplaza el patrón anterior de parchear el objeto `Trip` a mano después de cada mutación — ahora cada acción exitosa solo refetchea, P10), agrega un botón "Ver recorrido" (`getTripRoute`) y usa `getPodForDelivery` para deshabilitar "Registrar POD" por POD real ya registrado (antes usaba `delivery.status === 'FINALIZADO'` como proxy, que no distingue "finalizado por remito completo" de "finalizado con POD").

## Deuda documentada, no implementada (fuera de alcance de esta tanda)

- Override de capacidad y modo `filtro` sin UI en `CreateTripModal` (ver arriba).
- `confirmarRecepcionDevolucion` (ADR-010 sección 6) no implementado.
- Documentos impresos (ADR-011 sección 7) no implementados.
- Vehículo/Chofer alcance EMPRESA (no SUCURSAL) — decisión tomada sin ADR propio, documentada en `vehicle.types.ts`/`driver.types.ts`.
