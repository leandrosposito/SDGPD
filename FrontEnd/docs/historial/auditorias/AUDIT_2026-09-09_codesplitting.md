# AUDIT 2026-09-09 — Code-splitting por ruta (Tanda 10A)

**Verificado contra el filesystem el 2026-09-09**, rama `sesion-codesplitting` partida de `lean` (`b15d068`).

## Alcance revisado

`src/shared/routes/AppRoutes.tsx`, `src/shared/layouts/AppShell.tsx` (solo para ubicar el `<Suspense>`), `vite.config.ts`, `package.json` (solo lectura, para saber qué vendors existen realmente). Build real corrido contra este commit antes de tocar nada.

## Qué hay hoy (antes de esta tanda)

- **AUDIT_8_RENDER_BUNDLE.md #1/#2 (ALTO, abiertos):** 0 resultados de `React.lazy`/`lazy(` en todo `src/` (confirmado de nuevo hoy). Bundle único: `dist/assets/index-DAocKNs8.js` = **1.537,42 kB** (gzip 438,98 kB) + `dist/assets/index-Bn00OraQ.css` = 138,04 kB (gzip 17,44 kB). Empeoró respecto de la medición de AUDIT_8 (1.470,62 kB) y respecto de la previa a Tanda 9 (1.526,70 kB) — ver `docs/ESTADO.md`.
- `AppRoutes.tsx` (113 líneas) importa los 10 módulos de forma estática al tope del archivo, todos declarados dentro de `<Route element={<AppShell/>}>`. No hay ninguna ruta de autenticación (grep `login|Login|auth|Auth` en `src/shared/routes/` → 0 resultados) — no hay backend, no hay sesión real, así que el criterio "las rutas de autenticación quedan síncronas" del enunciado no aplica a este proyecto hoy: no hay ninguna que excluir por ese motivo.
- No hay ninguna ruta con parámetro de path (`:id`, etc.) — las 10 son paths fijos (`/pedidos`, `/inventario`, ...). El único mecanismo de deep-link es `useSearchParams` (query string), vía `src/shared/hooks/useUrlListState.ts` (usado por 9 de los 10 módulos: todos salvo `dashboard`, que usa un query param propio de sucursal en `useDashboardAggregates.ts`) o directamente en `ComprasPage.tsx`.
- `vite.config.ts` (13 líneas): solo el plugin de React y el alias `@/`. Sin `build.rollupOptions` ni equivalente.
- `AppShell.tsx` ya tiene un `<ErrorBoundary resetKey={location.pathname}>` envolviendo `<Outlet/>` (D4, `DECISIONES_TECNICAS.md`) — es el punto natural para agregar el `<Suspense>`, ver ADR-012.
- **Hallazgo de infraestructura, no de negocio:** `vite` en este proyecto es la 8.0.16, que corre sobre **Rolldown** (no sobre Rollup clásico) — confirmado en `node_modules/vite/dist/node/index.d.ts:2092` (`rollupOptions?: RolldownOptions`). La opción clásica de Rollup `output.manualChunks` como objeto (`{ vendor: [...] }`) no es la forma recomendada acá: Rolldown la soporta solo como función y la tiene **deprecada** en favor de `output.codeSplitting.groups` (`node_modules/rolldown/dist/shared/define-config-*.d.mts:786-834`). Se usa `codeSplitting.groups`, que es "el equivalente" que habilita el enunciado de la tarea.

## Qué está bien (no romper)

- `useUrlListState` y el resto de los hooks de listado leen la URL en el primer render vía `useSearchParams` del propio Router — no dependen de que el componente exista antes de que la navegación ocurra, así que no hay ninguna carrera entre "la ruta cambió" y "el chunk lazy todavía no cargó": React Router resuelve la URL primero, decide qué elemento renderizar (el lazy), y recién ahí el lazy dispara el `import()`. El estado de filtros en la URL no se pierde ni se resetea por lazy-loading.
- El `<ErrorBoundary resetKey={location.pathname}>` de `AppShell.tsx` ya cubre el caso de un chunk que falla al cargar (ej. sin red): un error de `import()` rechazado es un error de render como cualquier otro para el boundary de React.

## Plan de tanda (una sola, según el enunciado)

1. Los 10 `import` estáticos de `AppRoutes.tsx` pasan a `React.lazy(() => import(...).then(...))` (los módulos exportan con named export, no default — hay que mapear `default: m.XPage`).
2. Un único `<Suspense>` se agrega en `AppShell.tsx`, envolviendo `<Outlet/>`, adentro del `ErrorBoundary` existente (no en `AppRoutes.tsx` envolviendo `<Routes>` — ver ADR-012 para el porqué).
3. `vite.config.ts` agrega `build.rollupOptions.output.codeSplitting.groups` para separar `react`, `react-dom`, `@tanstack/react-query`, `zod` y `lucide-react` del chunk de entrada.

## Riesgo identificado y decisión — NO se movió a lazy

Ninguno. Los 10 módulos son heavies por el criterio del enunciado (cada uno tiene su propio árbol de componentes en `components/` y al menos un hook de datos) y ninguno tiene un import circular ni ninguna otra razón detectada para quedar síncrono. No se encontró ningún caso que requiera "dejarlo síncrono con una nota".
