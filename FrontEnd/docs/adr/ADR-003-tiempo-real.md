# ADR-003 — "Tiempo real"

**Estado:** Decidido, **enmendado 2026-09-09** (ver "Enmienda 2026-09-09" al final — la decisión original sigue vigente sin cambios, la enmienda solo agrega un grado de libertad nuevo). **Fecha:** 2026-09-07.

## Problema

Tanda 8 (seguimiento de viaje) y Tanda 7 (alertas) necesitan que la UI refleje cambios que puede haber hecho otro usuario/proceso sin que el usuario actual recargue la página a mano. Hay que elegir un mecanismo de transporte sin backend real todavía, que no comprometa a una tecnología concreta el día que exista.

## Opción elegida

- **Polling, no WebSocket ni SSE.** `refetchInterval` de TanStack Query, **30 segundos por defecto**, configurable por una constante nombrada (no un número suelto en cada call-site — mismo criterio que `CACHE_STALE_TIME` en `useCachedQuery.ts`).
- **`refetchIntervalInBackground: false`** — con la pestaña en segundo plano, no se consulta. Coherente con la decisión ya tomada en `queryClient.ts` de `refetchOnWindowFocus: false` (un ERP de uso interno con alt-tab constante no necesita refrescar fuera de foco).
- **Todo detrás de un hook `useLiveQuery` en `shared/`**, que envuelve `usePagedQuery`/`useCachedQuery` (no los reemplaza) agregando el `refetchInterval`. Cambiar el transporte después (WebSocket, SSE) implica reescribir `useLiveQuery` por dentro — ningún componente que lo consuma cambia.
- **El polling nunca trae la lista completa.** Pide el mismo endpoint paginado, con los mismos filtros vigentes (los de la URL, ver Tanda 4) — un refetch de polling es indistinguible, del lado del servidor, de un refetch manual del usuario.

## Alternativas descartadas

1. **WebSocket.** Descartada por ahora: exige un servidor con soporte de conexiones persistentes y un protocolo de mensajes a diseñar, sin backend real todavía es sobre-ingeniería — y el caso de uso (ver el estado de 10-50 entregas en tránsito, contadores de alertas) no tiene el volumen ni la latencia crítica que justificaría el costo de mantener conexiones abiertas.
2. **Server-Sent Events (SSE).** Descartada por la misma razón que WebSocket — menos costoso de implementar en el servidor, pero sigue exigiendo un endpoint de streaming que no existe y que el mock no puede simular de forma realista sin trabajo extra que no aporta valor a esta ronda.
3. **`refetchIntervalInBackground: true`.** Descartada por consistencia con la decisión ya tomada de no refrescar fuera de foco (`refetchOnWindowFocus: false`) — dejarlo prendido solo para polling sería inconsistente sin una razón de negocio que lo justifique.

## Qué se rompe si se cambia después

- Si se migra a WebSocket/SSE sin pasar por `useLiveQuery` (un componente empieza a escuchar un socket directo), se pierde el punto de la abstracción — cualquier tanda futura que agregue "tiempo real" a un listado nuevo debe usar el hook, no reinventar el transporte por su cuenta.
- Si el intervalo de 30s deja de ser una constante nombrada y se hardcodea por call-site, cambiar la cadencia global (ej. por carga de servidor) exige tocar N archivos en vez de uno.
- Si el polling llega a traer la lista completa "por simplicidad" en algún punto, se reintroduce el problema que A3 (paginación) ya identificó como ALTO en Reposición — un refetch periódico sin paginar escala peor que uno manual porque ocurre solo, sin que el usuario lo note.

## Enmienda 2026-09-09 — intervalo configurable por consumidor

**Motivo:** ADR-011 (viajes y asignación) necesita mostrar la posición de un vehículo en movimiento — 30 segundos es razonable para una lista de entregas (cambia por acción humana, no cada segundo) pero es demasiado lento para un punto en un mapa que se mueve de verdad; un vehículo real recorre una distancia notable en 30s. La opción original de ADR-003 fijaba el intervalo como una única constante nombrada, sin margen por consumidor — esta enmienda lo extiende sin reabrir ninguna de las decisiones de arriba.

**Cambio:** `useLiveQuery` acepta un intervalo por consumidor (parámetro opcional en su firma). **Default: 30 segundos, sin cambios para todos los consumidores actuales** (`LogisticsPage` y cualquier otro que no pase el parámetro explícito siguen exactamente igual que hoy). **La posición del viaje (ADR-011, sección 4) usa 10-15 segundos**, pasado explícitamente por ese consumidor puntual.

**Lo que esta enmienda NO cambia, a propósito:**
- `refetchIntervalInBackground: false` sigue aplicando siempre, para cualquier intervalo — un intervalo más corto no significa que valga la pena consultar con la pestaña en segundo plano.
- El polling sigue sin traer nunca la lista/colección completa — un intervalo más corto sobre un payload chico (un solo punto `{ lat, lng, timestamp }`, ver ADR-011 sección 4) es aceptable; un intervalo más corto sobre una lista paginada completa NO estaría cubierto por esta enmienda.
- **Prohibido un mecanismo de polling paralelo por fuera de `useLiveQuery`** (ej. un `setInterval` propio en el componente de mapa) — dos mecanismos de "tiempo real" en el mismo proyecto significan dos comportamientos de segundo plano/reintentos/cancelación distintos, y uno de los dos inevitablemente queda peor mantenido que el otro. Todo lo que necesite un intervalo distinto pasa por este mismo hook con el parámetro nuevo, nunca por su cuenta.

**Qué se rompe si se cambia después:** si un componente nuevo necesita un intervalo distinto a 30s sin pasar por este parámetro (hardcodeando su propio `setInterval` o un `refetchInterval` directo sobre `usePagedQuery`), se reintroduce exactamente el riesgo que esta enmienda cierra — la regla sigue siendo "todo tiempo real pasa por `useLiveQuery`", ahora con un grado más de libertad (el intervalo), no con una puerta lateral nueva.
