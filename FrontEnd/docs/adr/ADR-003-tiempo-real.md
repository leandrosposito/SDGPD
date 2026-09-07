# ADR-003 — "Tiempo real"

**Estado:** Decidido. **Fecha:** 2026-09-07.

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
