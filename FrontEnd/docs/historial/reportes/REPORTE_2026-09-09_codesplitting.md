# Reporte — 2026-09-09 — Tanda 10A: code-splitting por ruta

Rama de sesión: `sesion-codesplitting`, partida de `lean` en `b15d068` (tag `pre-codesplitting`).

## Qué hice, por tanda

**Tanda 10A (única tanda de la sesión) — HECHA.**

1. Los 10 imports estáticos de `<Módulo>Page` en `src/shared/routes/AppRoutes.tsx` pasaron a `React.lazy(() => import(...).then(m => ({ default: m.<Módulo>Page })))` (named export, no default). Ningún módulo quedó sin convertir — no se encontró ningún caso con import circular u otro impedimento (ver `AUDIT_2026-09-09_codesplitting.md`, sección "Riesgo identificado").
2. Un único `<Suspense fallback={<LoadingState message="Cargando modulo..." />}>` se agregó en `src/shared/layouts/AppShell.tsx`, envolviendo `<Outlet/>`, adentro del `ErrorBoundary` por-ruta ya existente — **no** en `AppRoutes.tsx` alrededor de `<Routes>` (decisión documentada en ADR-012, evita que Sidebar/Header se desmonten al navegar entre rutas lazy).
3. `vite.config.ts` agregó `build.rollupOptions.output.codeSplitting.groups` con 5 grupos (`vendor-react-dom`, `vendor-react`, `vendor-tanstack`, `vendor-zod`, `vendor-lucide`) — no `manualChunks`: este proyecto corre Vite 8 sobre Rolldown, donde `manualChunks` está deprecada a favor de `codeSplitting` (ver ADR-012).
4. `docs/ARQUITECTURA.md` actualizado (sección Rutas) para documentar el lazy-loading — no hubo cambio de estructura de carpetas, pero sí de comportamiento de ese archivo.

No hubo tandas adicionales — el enunciado pedía una sola.

## Commits creados

Un solo commit en `sesion-codesplitting`, mergeado a `lean` con `--no-ff` (ver hash real en el `git log` del repo — el merge queda como commit revertible con `git revert -m 1 <hash-del-merge>`).

## Decisiones que tomé sin consultar

1. **Ubicación del `<Suspense>`: en `AppShell.tsx` envolviendo `<Outlet/>`, no en `AppRoutes.tsx` envolviendo `<Routes>`.** El enunciado decía "un solo `<Suspense>` en el nivel del router", que se puede leer literal (adentro de `AppRoutes.tsx`) o como "un límite compartido para todas las rutas". Elegí la segunda lectura porque la primera provoca que todo el shell (Sidebar/Header) se desmonte en cada navegación entre rutas lazy — un problema de UX real, no cosmético. Documentado en ADR-012 con el razonamiento completo y las alternativas descartadas.
2. **`output.codeSplitting.groups` en vez de `build.rollupOptions.output.manualChunks`.** El enunciado nombraba `manualChunks` "o el equivalente" — usé el equivalente porque este Vite corre sobre Rolldown, donde `manualChunks` (como objeto, la forma clásica de Rollup) ni siquiera existe, y como función está deprecada. Documentado en ADR-012 y en `AUDIT_2026-09-09_codesplitting.md`.
3. **Los 10 módulos, incluido `dashboard` (ruta índice), pasan a lazy.** El enunciado eximía explícitamente "las rutas de autenticación y el layout raíz" — no al Dashboard por ser la ruta por defecto. Como no hay ninguna ruta de autenticación en el proyecto (no hay backend/login todavía), el único módulo que podría discutirse era Dashboard por ser lo primero que ve cualquier usuario; decidí no eximirlo porque igual cumple el criterio de "pesado" (tiene `SalesChart`/`TopProductsChart`/`RecentOrdersTable` propios + hooks de datos) y el enunciado no lo exceptuaba.
4. **Escribí ADR-012** porque ninguno de los 11 ADRs existentes cubre routing/code-splitting — regla 2.9 del protocolo.

## Hallazgos de la Fase D y cómo los corregí

Ninguno — no se encontró ningún hallazgo CRÍTICO ni ALTO en la Fase D de esta tanda. Ver detalle de cada verificación abajo.

- **D1 (migración a medias):** no aplica — esta tanda no cambia ninguna representación de datos, solo el mecanismo de import de componentes. No hay dos formas conviviendo de nada.
- **D2 (integridad referencial de mocks):** corridos los 3 scripts de `scripts/verificacion/` (`v-adr009-order-branch-links.mjs`, `v11-referential-integrity.mjs`, `v2-order-client-integrity.mjs`) — los 3 pasan, sin relación con esta tanda (no se tocó ningún mock).
- **D3 (el diff dice lo que el informe dice):** las 3 afirmaciones de arriba (lazy en los 10 módulos, Suspense en AppShell, codeSplitting.groups en vite.config.ts) están respaldadas por `git diff` — ver diff completo en el commit.
- **D4 (reglas de escalabilidad):** no aplica ninguna regla de la sección 3 del protocolo a este diff — no hay listados, agregados, exportaciones, query keys, services, dinero ni requests nuevos.
- **D5 (conformidad con ADRs):** ADR-012 es el único que aplica, y el código lo sigue (verificado releyendo el diff contra el ADR recién escrito).
- **D6 (seguridad de tipos):** cero `any`/`as`/`@ts-ignore` nuevos — `grep -n "as \w\|any\b\|@ts-ignore"` sobre el diff no encontró nada relevante (hay un `as` en el código preexistente de otros archivos, ninguno en el diff de esta sesión).
- **D7 (restos):** ninguno — no se reemplazó ningún hook/servicio/schema, solo se cambió la forma de importar componentes ya existentes.
- **D8 (build desde cero):** ver sección siguiente.

### D8 — build desde cero

```
git status --porcelain   → limpio antes de empezar (rama recién creada desde lean limpio)
rm -rf node_modules && npm ci
tsc --noEmit              → 0 errores
npm run lint               → 1 warning preexistente (PurchaseOrderFormModal.tsx:176, ajeno a esta tanda,
                              confirmado corriendo lint contra el commit base con `git stash` antes de esta sesión)
npm run build (tsc -b && vite build) → build exitoso, ver tabla de bundle abajo
8 smoke scripts (scripts/smoke/*.mjs) → los 8 pasan
```

`git diff` contra `package.json` y `package-lock.json`: sin cambios (no se instaló nada).

## Hallazgos MEDIO/BAJO documentados y no tocados

- **Chunk `zod-CN6suv00.js` (36,42 kB) es un nombre engañoso** — no es la librería `zod`, es código de `react-hook-form` + `@hookform/resolvers/zod` (el adaptador) que Rolldown nombró automáticamente "zod" por el subpath del import (`@hookform/resolvers/zod`). El grupo `vendor-zod` (64,14 kB) sí contiene la librería `zod` real — verificado inspeccionando el contenido de ambos archivos (`createLucideIcon`/`ZodError`/`checkbox`-type markers). No es un bug, es un artefacto cosmético del nombrado automático de Rolldown — se documenta para que nadie lo confunda con una duplicación de zod en el futuro.
- **`Table-*.js` (340,48 kB) y `BarChart-*.js` (346,99 kB) son los dos chunks más pesados del build, más grandes que cualquier chunk de módulo.** Son código compartido (el componente `Table` de `shared/components/ui/`, usado por 8 de los 10 módulos; `recharts`, usado por `dashboard`/`analytics`) que Rolldown separó automáticamente por ser compartido entre múltiples puntos de entrada — no están en el chunk inicial (no aparecen en `index.html`), se piden la primera vez que una ruta que los necesita se visita y quedan cacheados para las demás. No se tocó nada acá: es el comportamiento automático correcto, fuera del alcance declarado de esta tanda (`xlsx`/`recharts` no estaban en la lista de vendors a separar manualmente).
- **La separación de vendors (`vendor-react-dom`/etc.) subió el peso crudo de la primera carga en ~5% respecto de solo el route-splitting** (327,26 kB en 1 archivo → ~344 kB en 5 archivos) — ver tabla abajo y el razonamiento de trade-off en ADR-012. Se acepta por el beneficio de cacheo entre deploys, no por reducir la primera carga (eso ya lo resolvió el route-splitting solo).

## Riesgos introducidos

- Si algún componente de `Sidebar`/`Header` pasa a ser lazy en el futuro, hay que revisar si el único `<Suspense>` actual (en `AppShell.tsx`) sigue siendo la ubicación correcta — ver ADR-012, "Qué se rompe si se cambia después".
- Un fallo de red al cargar un chunk lazy ahora es visible al usuario como el fallback genérico del `ErrorBoundary` ("Ocurrió un error al mostrar esta pantalla") en vez de simplemente no pasar nunca (antes todo el código ya estaba descargado de entrada) — comportamiento nuevo, no verificado en el navegador con throttling real (ver checklist).

## Qué NO verifiqué (esta verificación es estática, no abre un navegador)

- Nada de lo anterior se probó en un navegador real. `docs/historial/verificaciones/VERIFICACION_TANDA_10A.md` tiene el checklist completo para que Leandro lo corra — en particular los puntos 2 y 3 (que el shell no parpadee al navegar entre rutas lazy) son el corazón de la decisión de ADR-012 y no hay forma de confirmarlos sin abrir el navegador.
- Tiempo de carga real en una red lenta (esta sesión solo midió tamaño de bundle, no tiempo).
- Deep-link con filtros de URL: verificado por lectura de código (React Router resuelve la URL antes de que el lazy dispare el `import()`, así que no hay condición de carrera posible), no ejercitado a mano navegador por navegador — ver checklist, puntos 4-6.

## Qué tiene que probar Leandro a mano, en orden de riesgo

1. Navegar entre 2+ módulos no visitados antes y confirmar que el Sidebar/Header no parpadean (punto 2 del checklist) — es la parte de esta tanda con más superficie de regresión de UX si algo salió mal.
2. Al menos 3 deep-links directos con filtros en la URL (punto 4) — confirma que el estado en URL (regla de escalabilidad #8 del protocolo) sigue siendo la única fuente de verdad incluso con lazy-loading.
3. Recarga (F5) parado en una ruta que no es `/` (punto 5).
4. El resto del checklist (`VERIFICACION_TANDA_10A.md`), en el orden que está escrito.

## Bundle — antes / después (chunk por chunk)

**Medido con `npm run build` contra el mismo commit base (`b15d068`, `lean`) y contra el final de esta sesión — reproducible, corrido 2 veces con resultado idéntico.**

### Antes (baseline, `lean` sin esta tanda)

| Archivo | Tamaño | gzip |
|---|---|---|
| `index-*.js` (único chunk de app) | 1.537,42 kB | 438,98 kB |
| `index-*.css` (único chunk de estilos) | 138,04 kB | 17,44 kB |
| **Total inicial (todo lo que se descarga antes de la primera pantalla)** | **1.675,46 kB** | **456,42 kB** |

### Después (esta tanda, con route-splitting + vendor chunking)

**Lo que se descarga antes de ver el Dashboard (referenciado en `index.html` via `<script>`/`modulepreload`):**

| Archivo | Tamaño | gzip |
|---|---|---|
| `index-*.js` (glue de la app: main.tsx, AppRoutes, AppShell, Sidebar, Header, queryClient, sessionStore) | 112,76 kB | 34,33 kB |
| `rolldown-runtime-*.js` | 0,69 kB | 0,42 kB |
| `vendor-react-dom-*.js` | 189,27 kB | 59,50 kB |
| `vendor-react-*.js` | 0,43 kB | 0,30 kB |
| `vendor-tanstack-*.js` | 32,83 kB | 9,77 kB |
| `vendor-lucide-*.js` | 8,11 kB | 3,08 kB |
| `index-*.css` | 21,86 kB | 4,46 kB |
| **Total inicial** | **365,95 kB** | **111,86 kB** |

**Reducción del chunk inicial: −78,2% crudo, −75,5% gzip.**

**El resto (10 páginas de módulo + servicios + `Table`/`BarChart` compartidos) se carga solo cuando la ruta que lo necesita se visita, no antes:**

| Archivo | Tamaño | gzip | Se carga cuando... |
|---|---|---|---|
| `DashboardPage-*.js` (+css) | 43,02 + 12,22 kB | 12,29 + 2,08 kB | se visita `/` |
| `OrdersPage-*.js` (+css) | 36,95 + 16,21 kB | 9,23 + 2,84 kB | se visita `/pedidos` |
| `InventoryPage-*.js` (+css) | 56,44 + 19,08 kB | 12,80 + 2,61 kB | se visita `/inventario` |
| `ClientsPage-*.js` (+css) | 32,36 + 10,97 kB | 7,55 + 2,03 kB | se visita `/clientes` |
| `SuppliersPage-*.js` (+css) | 18,88 + 10,06 kB | 5,67 + 1,82 kB | se visita `/proveedores` |
| `ComprasPage-*.js` (+css) | 25,80 + 8,94 kB | 6,83 + 1,59 kB | se visita `/compras` |
| `LogisticsPage-*.js` (+css) | 21,28 + 7,38 kB | 6,75 + 1,60 kB | se visita `/logistica` |
| `CashPage-*.js` (+css) | 19,12 + 8,80 kB | 5,41 + 1,70 kB | se visita `/caja` |
| `AnalyticsPage-*.js` (+css) | 42,65 + 6,55 kB | 12,17 + 1,29 kB | se visita `/analitica` |
| `SettingsPage-*.js` (+css) | 31,80 + 4,35 kB | 7,08 + 0,98 kB | se visita `/settings` |
| `Table-*.js` (compartido, 8 módulos) | 340,48 kB | 111,32 kB | primera vez que cualquier módulo con tabla se visita |
| `BarChart-*.js` (recharts, compartido) | 346,99 kB | 102,48 kB | primera vez que `dashboard`/`analytics` se visita |
| `vendor-zod-*.js` | 64,14 kB | 17,30 kB | primera vez que una ruta con un form validado con Zod se visita |
| `zod-*.js` (react-hook-form + adaptador, nombre engañoso — ver hallazgo MEDIO arriba) | 36,42 kB | 12,89 kB | idem |
| `orders.service`/`clients.service`/`products.service` | 25,01 / 22,87 / 19,30 kB | 6,65 / 5,45 / 4,65 kB | primera vez que el módulo que los usa se visita |
| resto (`Tabs`, `Modal`, `SidePanel`, `DateRangeFilter`, íconos sueltos, etc.) | < 13 kB cada uno | — | bajo demanda |

**Nota sobre el trade-off del vendor chunking (transparencia pedida por el enunciado, punto 1 de la autoauditoría):** el route-splitting solo (sin `codeSplitting.groups`) ya deja el chunk inicial en 327,26 kB / 101,07 kB gzip en 1 solo archivo. Agregar los 5 grupos de vendor lo sube a 344,09 kB / 107,40 kB gzip en JS (+5,1% crudo, +6,3% gzip), porque cada chunk adicional tiene su propio overhead de import/runtime. **Vale la pena igual** porque el objetivo de esa parte no es la primera carga (ya resuelta por el route-splitting) sino el cacheo entre deploys: `vendor-react-dom-*.js` (189 kB, el más pesado de los 5) cambia solo si se actualiza la versión de React, no con cada commit de negocio — un usuario que vuelve después de un deploy que no tocó dependencias no lo vuelve a descargar. Detalle completo en ADR-012.

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash-del-commit-de-merge-a-lean>
```
