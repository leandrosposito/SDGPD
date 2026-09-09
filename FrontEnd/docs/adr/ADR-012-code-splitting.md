# ADR-012 — Code-splitting por ruta: ubicación del Suspense y mecanismo de vendor chunking

**Estado:** Decidido. **Fecha:** 2026-09-09. Resuelve dos decisiones de diseño que la tarea de Tanda 10A dejaba abiertas y que ningún ADR previo cubre: dónde vive el `<Suspense>` y qué API de Vite se usa para separar los vendors del chunk de entrada.

## Problema

AUDIT_8_RENDER_BUNDLE.md (#1/#2) pedía `React.lazy` + `<Suspense>` por ruta en `AppRoutes.tsx`, y la tarea de esta tanda agregaba: "un solo `<Suspense>` en el nivel del router" y `manualChunks` "o el equivalente" para separar vendors. Dos cosas no estaban resueltas por ningún documento existente:

1. **Dónde exactamente vive el `<Suspense>`.** `AppRoutes.tsx` declara las rutas dentro de `<Route element={<AppShell/>}>`; `AppShell` renderiza `<Sidebar/>`, `<Header/>` y `<Outlet/>` para el contenido de la ruta activa. Un `<Suspense>` puesto literalmente alrededor de `<Routes>` en `AppRoutes.tsx` quedaría por ENCIMA de `AppShell` — como `AppShell` no es lazy, no dispararía el fallback él solo, pero cuando el hijo lazy (la página) suspende durante la navegación, React busca el `Suspense` ancestro más cercano y desmonta todo lo que está debajo de él, Sidebar y Header incluidos, hasta que el chunk cargue.
2. **Qué API de Vite usar para separar vendors.** El enunciado nombra `build.rollupOptions.output.manualChunks`, pero este proyecto corre Vite 8 sobre Rolldown (no sobre Rollup clásico) — ver `AUDIT_2026-09-09_codesplitting.md`. `manualChunks` como objeto (`{ vendor: [...] }`, la forma clásica de Rollup) no existe en Rolldown; como función existe pero está marcada `@deprecated` a favor de `output.codeSplitting.groups`.

## Opción elegida

### 1. El `<Suspense>` vive en `AppShell.tsx`, envolviendo `<Outlet/>`, adentro del `ErrorBoundary` por-ruta existente

No en `AppRoutes.tsx` alrededor de `<Routes>`. Con esto, navegar entre dos rutas lazy solo reemplaza el contenido (`<main>`) por el fallback — Sidebar y Header (que no son lazy) nunca se desmontan. Sigue siendo **un solo** `<Suspense>` compartido por las 10 rutas, tal cual pedía la tarea ("al nivel del router" se interpreta como "un límite compartido para todas las rutas", no "sintácticamente adentro del archivo `AppRoutes.tsx`") — no se anida un `<Suspense>` por `<Route>`.

Efecto secundario aprovechado: como ya existe `<ErrorBoundary resetKey={location.pathname}>` en el mismo lugar, un chunk que falla al importar (ej. sin red) cae en el mismo fallback de error que cualquier otro error de render de la ruta, sin código nuevo.

### 2. Vendor chunking con `output.codeSplitting.groups`, no `manualChunks`

Se usa la API no deprecada de Rolldown. Grupos declarados en `vite.config.ts`, uno por librería pedida en el enunciado (`react`, `react-dom`, `@tanstack/react-query` vía `@tanstack`, `zod`, `lucide-react`), cada uno con `test` como regex de path (`/node_modules[\\/]<paquete>[\\/]/`, con `[\\/]` en vez de `/` literal por la advertencia de la propia documentación de Rolldown sobre Windows).

**Verificado el trade-off, no asumido:** el code-splitting por ruta (punto 1 de esta ADR) ya reduce el chunk de entrada de 1.537,42 kB a 327,26 kB por sí solo, sin ninguna config de vendor. Agregar los grupos de vendor lo vuelve a subir levemente en bytes totales de la primera carga (327,26 kB en 1 archivo → ~344 kB repartidos en 5 archivos, +~5% crudo, +~6% gzip) porque cada chunk adicional tiene su propio overhead de runtime/imports. Se acepta igual porque el objetivo de esta parte no es bajar la primera carga (eso ya lo resolvió el punto 1) sino **cacheable por separado entre deploys**: `react-dom` (189 kB) cambia con la versión de React, no con cada commit de la app — separado, un usuario que vuelve después de un deploy que solo tocó código de negocio no vuelve a descargarlo. Documentado en detalle con cifras en `AUDIT_2026-09-09_codesplitting.md` / `REPORTE_2026-09-09_codesplitting.md`.

## Alternativas descartadas

1. **`<Suspense>` en `AppRoutes.tsx` alrededor de `<Routes>`.** Es lo que el enunciado sugiere literalmente ("en el nivel del router"), pero produce el problema de UX descripto arriba (parpadeo de todo el shell, no solo del contenido) cada vez que se navega entre dos rutas lazy. Descartada por esa razón, no por preferencia estética.
2. **Un `<Suspense>` por `<Route>` en `AppRoutes.tsx`.** Resolvería el mismo problema de shell-flicker sin tocar `AppShell.tsx`, pero el enunciado pide explícitamente evitar esto "salvo que haya una razón concreta" — y la razón concreta (no desmontar el shell) se resuelve igual de bien con un solo `Suspense` puesto en el lugar correcto, sin repetir el fallback 10 veces.
3. **`manualChunks` como función** (`(id) => id.includes('node_modules') ? 'vendor' : undefined`), la forma no deprecada más simple de Rolldown. Descartada porque agrupa TODO `node_modules` (incluidos `recharts`/`xlsx`, que hoy ya quedan fuera del chunk de entrada gracias al lazy-loading de rutas) en un solo chunk gigante — exactamente lo que el code-splitting por ruta ya evitaba. `output.codeSplitting.groups` permite separar solo las 5 librerías pedidas, dejando que Rolldown siga chunkeando automáticamente todo lo demás por punto de entrada.

## Qué se rompe si se cambia después

- Si se agrega una ruta nueva de autenticación real (cuando exista backend), tiene que evaluarse de nuevo si conviene síncrona (carga inmediata, sin flash de loading en el login) o lazy — el enunciado de esta tanda la eximía explícitamente pero hoy no existe ninguna, así que la decisión no se tomó todavía, queda para cuando se implemente.
- Si algún componente de `Sidebar`/`Header` pasara a ser lazy en el futuro, el argumento de "el shell no se desmonta" de esta ADR deja de ser cierto para esa parte — habría que revisar si conviene un `Suspense` adicional más granular ahí, no reusar ciegamente este mismo boundary.
- Si Vite/Rolldown deprecan también `codeSplitting.groups` en una versión futura, hay que revisar `node_modules/rolldown/dist/shared/define-config-*.d.mts` de nuevo antes de tocar `vite.config.ts` — la API de chunking de este bundler cambió una vez ya en la vida de este proyecto (de Rollup a Rolldown) sin que ningún doc lo dijera hasta esta ADR.
