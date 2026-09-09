# Verificación Tanda 10A — Code-splitting por ruta

**Fecha:** 2026-09-09. Implementa ADR-012. Alcance: `src/shared/routes/AppRoutes.tsx`, `src/shared/layouts/AppShell.tsx`, `vite.config.ts` — sin lógica de negocio.

## Qué verificar en el navegador

1. **Carga inicial (`/`).** Abrir la app desde cero (hard refresh, cache de disco vaciada). Debe aparecer el shell (Sidebar/Header) casi de inmediato y, brevemente, el spinner "Cargando modulo..." en el área de contenido antes de que el Dashboard aparezca. Con las DevTools → Network abiertas, confirmar que se piden `vendor-react-dom-*.js`, `vendor-react-*.js`, `vendor-tanstack-*.js`, `vendor-lucide-*.js` como parte de la carga inicial (vía `<link rel="modulepreload">`) y que `DashboardPage-*.js` se pide aparte.
2. **Navegar entre 2 módulos NO visitados antes (primera carga de cada uno).** Desde el Sidebar, ir a `/pedidos` y después a `/inventario` sin recargar la página entre medio. En cada click: el Sidebar y el Header **no deben desaparecer ni parpadear** — solo el área de contenido muestra el spinner brevemente y después la pantalla real. Si en algún momento se ve todo el shell reemplazado por el fallback (sidebar incluido), es un indicio de que el `<Suspense>` quedó mal ubicado — avisar, no es el comportamiento esperado.
3. **Navegar de nuevo a un módulo ya visitado.** Volver a `/pedidos` (ya cargado en el paso 2) — no debe verse el spinner en absoluto, el chunk ya está en memoria/cache del navegador.
4. **Deep-link directo con filtros en la URL (pegar la URL y Enter, no navegar por Sidebar) — probar al menos 3 de estas, cualquiera sirve como muestra representativa de las 9 que usan `useUrlListState`:**
   - `/pedidos?page=2` (o cualquier filtro que ya se use en Pedidos)
   - `/inventario` con un tab + filtro de la URL
   - `/clientes` con un filtro de la URL
   - `/compras` (el único módulo que usa `useSearchParams` directo, no `useUrlListState` — confirmar que también sobrevive el deep-link)

   En todos los casos: la pantalla tiene que abrir directamente con el filtro/página/tab de la URL ya aplicado, sin que haya que volver a elegirlo a mano — el lazy-loading no debe "perder" el estado de la URL en el primer render.
5. **Recargar (F5) parado en una ruta que no es `/`.** Ej. estar en `/logistica`, hacer un hard refresh. Debe cargar directo esa pantalla (con su spinner de carga inicial), no redirigir a `/` ni mostrar un error.
6. **Ruta inexistente.** Ir a una URL que no existe (ej. `/no-existe`) — debe seguir redirigiendo a `/` (el catch-all `<Route path="*">`), igual que antes de esta tanda.
7. **Simular un fallo de red al cargar un chunk (opcional, si se puede con DevTools → Network → Offline justo antes de navegar a un módulo no cacheado todavía).** Debe caer en el fallback de error del `ErrorBoundary` ("Ocurrió un error al mostrar esta pantalla"), no en una pantalla en blanco ni un error no controlado en consola.

## Qué NO se verificó (queda para Leandro)

- Medición de tiempo de carga real en una red lenta/throttled — esta sesión solo midió tamaño de bundle (`vite build`), no tiempo real en el navegador.
- Los 6 módulos restantes con `useUrlListState` que no se listaron en el paso 4 (`proveedores`, `caja`, `logistica`, `analitica` con su período, `settings` con sus tabs) — mismo mecanismo que los probados, pero no se listaron uno por uno para no alargar el checklist; si alguno falla puntualmente, es una señal de que ese módulo en particular tiene algo especial, no que el mecanismo de lazy-loading en general esté roto.
- Comportamiento en un browser real con `Service Worker`/PWA — el proyecto no tiene ninguno, no aplica.

## Medición de bundle — antes / después

Ver tabla completa en `docs/historial/reportes/REPORTE_2026-09-09_codesplitting.md`. Resumen: chunk de entrada (lo que se descarga antes de la primera pintura del shell) bajó de **1.537,42 kB en 1 archivo** a **~344 kB repartidos en 5 archivos** (index + 4 vendors que se cargan vía `modulepreload`), el resto (10 páginas de módulo + `Table`/`BarChart`/servicios) pasa a cargarse solo cuando la ruta que los necesita se visita.
