# Verificación funcional manual — Tandas 0 y 1

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice exactamente qué configurar, qué hacer y qué mirar.

**Qué cubre:** Tanda 0 (contención de errores: `ErrorBoundary` extendido, `ErrorState`, `LoadingState`, `logError`, boundaries en el router) y Tanda 1 (capa `api/` con `httpClient`/`ApiError`, piloto `suppliers` migrado a `usePagedQuery` server-side).

**Servidor de desarrollo:** ya está corriendo en **http://localhost:5173/** (PID 14488, verificado por ruta antes de dejarlo — `FrontEnd\node_modules\vite\bin\vite.js`). No hace falta que lo levantes vos, pero si lo cerrás o se cae, el comando es `npm run dev` desde `FrontEnd/` (Vite prueba puertos 5173+ en orden si están ocupados; fijate qué puerto real te muestra en la terminal — no des por sentado que sigue siendo 5173).

**Cómo cambiar de escenario (latencia / fallo / debug):** Vite lee las variables de entorno **una sola vez al arrancar** — no hay hot-reload de `.env*`. Para cada punto que pida una variable distinta:
1. Creá o editá `FrontEnd/.env.local` (no existe todavía — no vas a pisar nada) copiando el bloque correspondiente de `FrontEnd/.env.local.ejemplo-verificacion` (quitale el `#` de comentario a las líneas del escenario que quieras).
2. Cortá el servidor (`Ctrl+C` en su terminal, o pedime que lo mate yo si lo dejé en segundo plano) y arrancalo de nuevo (`npm run dev`).
3. Recargá la pestaña del navegador.

**Consola del navegador:** varios puntos piden mirar la consola (F12 → pestaña "Console"). `VITE_API_DEBUG=true` hace que `httpClient` imprima líneas con el formato `[httpClient] req-N <evento> {...}` — `N` es un número que se comparte entre todos los reintentos de una misma petición, así podés seguir el hilo de una sola llamada aunque haya varias en simultáneo.

---

## Tanda 0 — Contención de errores

### 1. El fallback del boundary aparece ante un error de render

Este punto necesita provocar un error real a propósito, y después revertirlo. Instrucciones exactas:

**a) Provocar el error:**
- Abrí `FrontEnd/src/modules/orders/OrdersPage.tsx`.
- Buscá la línea 54 (el inicio del componente):
  ```
  export const OrdersPage: FC = () => {
    const [orders, setOrders] = useState<Order[]>(ORDERS_MOCK_DATA);
  ```
- Agregá una línea nueva **entre esas dos**, así:
  ```
  export const OrdersPage: FC = () => {
    throw new Error('prueba boundary');
    const [orders, setOrders] = useState<Order[]>(ORDERS_MOCK_DATA);
  ```
- Guardá el archivo. Vite recarga solo (HMR) — no hace falta reiniciar el servidor para este cambio (no es una variable de entorno).

**b) Verificar en el navegador:**
- Andá a **http://localhost:5173/pedidos**.
- **Qué deberías ver:** en el lugar donde antes estaba la tabla de pedidos, un recuadro con ícono de alerta (triángulo), el texto **"Ocurrio un error al mostrar esta pantalla."** / "Intenta de nuevo o volve al inicio.", y dos botones: **"Reintentar"** y **"Volver al inicio"**.
- **Si no pasa esto:** si ves una pantalla en blanco total (no solo la zona de la tabla), o un error de Vite/React en pantalla completa en vez del recuadro, el boundary no está atrapando el error — anotalo, es un fallo real.

**c) Revertir (hacelo ANTES de seguir con los puntos 2-5, pero DESPUÉS de completarlos si preferís dejarlo un rato para probar varias cosas sobre el mismo error — a tu criterio):**
- Borrá la línea `throw new Error('prueba boundary');` que agregaste.
- Guardá. Confirmá con `git diff FrontEnd/src/modules/orders/OrdersPage.tsx` (o pedime que lo haga yo) que el archivo quedó igual que antes de tocarlo.

### 2. El resto de la app sigue viva

Con el error todavía provocado (punto 1a sin revertir):
- Mirá el **Sidebar** (menú lateral izquierdo) y el **Header** (barra superior, con el selector de sucursal y el buscador).
- Hacé click en cualquier ítem del Sidebar que NO sea "Pedidos" (ej. "Dashboard", "Clientes").
- **Qué deberías ver:** el Sidebar y el Header responden con normalidad (resaltan la sección activa, el buscador del Header se puede tipear), y navegar a otra sección funciona y muestra esa pantalla sin rastro del error de Pedidos.
- **Si no pasa esto:** si el Sidebar/Header tampoco responden, o toda la ventana quedó en blanco, el boundary "global" de `AppRoutes.tsx` se disparó en vez del boundary "por ruta" de `AppShell.tsx` — señal de que el error se está propagando más arriba de lo esperado (revisar la arquitectura, no solo el fallback visual).

### 3. "Reintentar" resetea el boundary sin recargar la página

Volvé a **http://localhost:5173/pedidos** (con el error todavía provocado).
- Antes de hacer click, fijate en la barra de direcciones o en algún estado visible que confirme que NO se recargó la página completa después del click (por ejemplo, si tenías el buscador del Header con texto tipeado, verificá que ese texto sigue ahí después del click — una recarga real de página lo borraría).
- Hacé click en **"Reintentar"**.
- **Qué deberías ver:** como el error sigue en el código (todavía no lo revertiste), la pantalla vuelve a mostrar el mismo fallback casi al instante — pero sin el parpadeo/blanco de una recarga de página completa. Es sutil: la señal más clara es que cualquier estado que tenías en OTRA parte de la pantalla (buscador del Header, sucursal seleccionada) sigue igual.
- **Si no pasa esto:** si al hacer click ves que la pestaña entera recarga (parpadeo blanco, la barra de direcciones "tilda" como si fuera una navegación nueva), algo está forzando un `window.location.reload()` en vez de resetear el estado de React — no debería estar pasando con esta implementación.

### 4. Navegar a otra ruta limpia el estado de error automáticamente

Con el error todavía provocado en `/pedidos`:
- Sin tocar "Reintentar", navegá directamente a otra ruta por el Sidebar (ej. "Inventario").
- Volvé a hacer click en "Pedidos" en el Sidebar.
- **Qué deberías ver:** la pantalla de Pedidos vuelve a mostrar el fallback de error (el `throw` sigue ahí, así que **debería** volver a romper) — pero lo importante es que el paso intermedio por "Inventario" mostró Inventario con total normalidad, sin arrastrar el error. Si en vez de eso revertiste ya el `throw` (punto 1c) antes de este punto, entonces al volver a "Pedidos" ahora sí deberías ver la tabla de pedidos normal, sin el fallback — confirmando que el boundary no quedó "trabado" en el estado de error después de que el código ya no rompe.
- **Recomendado:** hacé este punto 4 en dos pasadas: una con el `throw` todavía puesto (confirmás que Inventario no se ve afectado) y otra después de revertirlo (confirmás que Pedidos vuelve a la normalidad sin F5).
- **Si no pasa esto:** si después de revertir el `throw` y navegar de vuelta a "Pedidos" seguís viendo el fallback de error (sin haber recargado la página a mano), el reseteo automático por cambio de ruta (`resetKey` atado a la URL) no está funcionando.

### 5. El error aparece en consola con el formato de `logError`

Con el error todavía provocado, abrí la consola (F12 → Console) y recargá `/pedidos` una vez (F5, esta sí es una recarga real de página, para tener una consola limpia).
- **Qué deberías ver:** una entrada de `console.error` con el prefijo **`[SDGPD]`**, seguida de un objeto con las claves `message` (el texto "prueba boundary"), `stack` (el stack trace), `context` (un objeto con `componentStack`, el árbol de componentes de React donde ocurrió), y `timestamp` (fecha/hora ISO).
- **Si no pasa esto:** si ves un error en consola pero SIN ese formato (por ejemplo, el error crudo de React sin el prefijo `[SDGPD]`), `logError` no se está llamando desde `componentDidCatch` del boundary.

**No te olvides de revertir el `throw` (punto 1c) antes de pasar a la Tanda 1** si todavía no lo hiciste — los puntos de Tanda 1 usan la ruta `/proveedores`, así que técnicamente no interfiere, pero es más prolijo no dejar código de prueba a mitad de la verificación.

---

## Tanda 1 — Capa `api/` + piloto `suppliers`

Para esta sección necesitás `FrontEnd/.env.local` **sin** el bloque de latencia alta ni fallo forzado activo (Escenario A "Normal", o directamente sin `.env.local`) salvo que el punto indique lo contrario.

### 6. Listado de proveedores: carga, pagina, busca y ordena por las 4 columnas

- Andá a **http://localhost:5173/proveedores**.
- **Carga:** deberías ver una tabla con 3 proveedores (Molinos Cañuelas, Las Marías, Arcor — el mock tiene solo 3, así que no vas a ver paginación real con más de una página a menos que cambies el tamaño de página a algo muy chico, pero los controles de paginación deberían estar visibles igual, mostrando "Mostrando 1-3 de 3").
- **Búsqueda:** en el campo "Buscar por razon social o CUIT..." (arriba de la tabla), tipeá `arcor`. Después de un instante (hay un debounce de 300ms, no es instantáneo), la tabla debería quedar con 1 sola fila (Arcor S.A.I.C.). Borrá el texto — vuelven las 3 filas.
- **Filtro de rubro:** el `<select>` de al lado del buscador — elegí "Golosinas". Debería filtrar a 1 fila (Arcor). Volvé a "Todos los Rubros".
- **Orden:** hacé click en el encabezado **"Razon Social"** — debería reordenar (asc/desc alternando en cada click, con una flechita que cambia de dirección). Probá también **"Rubro"**, **"CUIT"** y **"Saldo Actual"** — los 4 encabezados son clickeables.
- **Qué significa si no pasa:** si la tabla no carga nada (pantalla en blanco o `LoadingState` que nunca termina), revisá la consola por errores; si la búsqueda/filtro no reduce las filas, el filtro no está llegando al service; si el click en un encabezado no cambia el orden visible, `setSort` no está conectado.

### 7. Latencia alta → `LoadingState` visible en la primera carga

- Poné en `.env.local` el **Escenario B** de `.env.local.ejemplo-verificacion` (`VITE_MOCK_LATENCY_MS=3000`), reiniciá el servidor, recargá `/proveedores`.
- **Qué deberías ver:** por ~3 segundos antes de que aparezca la tabla, un indicador centrado con un ícono girando y el texto **"Cargando proveedores..."** (ese es `LoadingState`, no el `SkeletonTable` gris que usan otras pantallas — son visualmente distintos a propósito, ver `DECISIONES_TECNICAS.md`).
- **Si no pasa esto:** si la tabla aparece casi instantánea a pesar de los 3000ms configurados, la variable no se está leyendo (¿reiniciaste el servidor después de crear/editar `.env.local`?); si en cambio lo que ves es un `SkeletonTable` (filas grises rectangulares) en vez del spinner + texto, `SuppliersPage` está usando el componente viejo, no `LoadingState`.

### 8. Fallo forzado → `ErrorState` visible, y el reintento funciona al bajar la tasa a 0

- Poné el **Escenario C** (`VITE_MOCK_FAILURE_RATE=1`, `VITE_API_DEBUG=true`), reiniciá el servidor, recargá `/proveedores`.
- **Qué deberías ver:** después de un rato (con reintentos de por medio, ver punto 9), en vez de la tabla aparece un bloque centrado con ícono de alerta, el texto **"No se pudo cargar el listado de proveedores."** y un botón **"Reintentar"**.
- Sin tocar nada del navegador todavía: editá `.env.local`, volvé `VITE_MOCK_FAILURE_RATE` a `0` (dejá `VITE_API_DEBUG=true`), reiniciá el servidor — **pero NO recargues la pestaña del navegador todavía**.
- Hacé click en el botón **"Reintentar"** de `ErrorState` (el que ya estaba en pantalla antes de reiniciar el servidor).
- **Qué deberías ver:** la tabla de proveedores carga con normalidad — el click disparó un nuevo pedido, que esta vez sí resuelve porque ya bajaste la tasa de fallo.
- **Si no pasa esto:** si `ErrorState` nunca aparece (la tabla queda cargando para siempre, o revienta blanco), revisá la consola; si aparece pero el botón "Reintentar" no hace nada visible, `onRetry`/`refetch` no está conectado.

### 9. Los 2 reintentos automáticos con backoff se ven en consola, con el mismo req-id

Repetí el **Escenario C** completo (`VITE_MOCK_FAILURE_RATE=1`, `VITE_API_DEBUG=true`), reiniciá el servidor, abrí la consola (F12) ANTES de recargar `/proveedores`, después recargá.
- **Qué deberías ver:** una secuencia de líneas `[httpClient] req-N ...` (mismo `N` en las 4 líneas de una misma carga):
  1. `req-N start {...}`
  2. `req-N retry {attempt: 1, afterMs: 300, causeCode: 'SERVER_ERROR', ...}`
  3. `req-N retry {attempt: 2, afterMs: 600, causeCode: 'SERVER_ERROR', ...}`
  4. `req-N error {attempt: 2, status: 503, code: 'SERVER_ERROR', ...}`
  - Entre la línea `start` y la primera `retry` debería pasar ~300ms (la latencia simulada default, salvo que también hayas dejado latencia alta); entre la primera y la segunda `retry`, ~300ms + 600ms de backoff. No hace falta que cronometres con precisión, alcanza con ver que el segundo intervalo es visiblemente más largo que el primero (backoff creciente).
- **Si no pasa esto:** si ves más de 2 líneas `retry` (más de 2 reintentos) o si ves un `retry` con `causeCode` distinto de `SERVER_ERROR`/`NETWORK_ERROR`/`TIMEOUT`, la política de reintentos no está respetando "solo red y 5xx"; si el `N` de `req-id` cambia entre las líneas de lo que debería ser una sola carga, cada reintento se está tratando como una petición nueva en vez de un reintento de la misma.

Volvé a poner `VITE_MOCK_FAILURE_RATE=0` en `.env.local` y reiniciá el servidor antes de seguir con los puntos siguientes.

### 10. Deep-link Proveedores→Compras ("Nueva OC" con proveedor seleccionado) intacto

- En `/proveedores`, hacé click en **"Ver detalle"** de cualquier fila (ej. Las Marías S.A.C.I.).
- Se abre un panel lateral con el nombre y CUIT del proveedor. Hacé click en el botón **"Nueva OC"** (arriba a la derecha del panel).
- **Qué deberías ver:** la app navega a `/compras`, se abre el modal "Nueva Orden de Compra", y el `<select>` de proveedor ya viene con **"Las Marías S.A.C.I."** preseleccionado (no "Seleccionar proveedor...").
- **Si no pasa esto:** si el modal se abre pero el proveedor NO viene preseleccionado, es el mismo bug de timing que ya se documentó y arregló una vez en `DECISIONES_TECNICAS.md` (O7) — señal de que algo en el repunteo de imports de esta tanda lo reintrodujo.

### 11. Alta y edición de proveedor

**Alta (sí es verificable por UI):**
- En `/proveedores`, click en **"Nuevo Proveedor"** (arriba a la derecha).
- Completá Razón Social y CUIT (los dos únicos campos obligatorios) con datos de prueba, click en **"Guardar Proveedor"**.
- **Qué deberías ver:** un toast de éxito ("Proveedor creado correctamente."), el modal se cierra, y el proveedor nuevo aparece en la tabla **sin que hayas recargado la página** (el listado se refresca solo).

**Edición — AVISO, léelo antes de buscar el botón:** revisé el código y **no existe ningún botón "Editar" en la pantalla de Proveedores hoy** — ni en la tabla ni en el panel de detalle (`SupplierDetailPanel.tsx` solo tiene "Nueva OC"). Confirmé con `git log` que esto es así desde antes de esta tanda (no lo rompí yo, y arreglarlo no estaba pedido en ninguna de las dos tandas — quedaría fuera de alcance agregarlo ahora sin que me lo pidas explícitamente). Así que:
- **No hay nada que verificar por UI para "edición" en este punto** — no busques un botón que no está.
- Si igual querés confirmar que `updateSupplier` funciona técnicamente (opcional, no bloquea la tanda), se puede invocar desde la consola del navegador (mismo método ya usado antes en el proyecto para casos sin botón en UI, ver `DECISIONES_TECNICAS.md`, entrada de "Cierre: Relación logistics↔orders"):
  ```js
  const svc = await import('/src/modules/suppliers/api/suppliers.service.ts');
  const empresaId = 'lo que tengas en useSessionStore, ej. copiá el id que veas en la pestaña de red o pedime que te lo confirme';
  await svc.updateSupplier(empresaId, 'sup-001', { name: 'Molinos Cañuelas S.A. (editado)', cuit: '30-54321678-9', category: 'Alimentos Secos', phone: '+54 11 4800-1200', contactEmail: 'r.leiva@molinoscanuela.com.ar' });
  ```
  Si eso no tira error y, al recargar `/proveedores`, la fila de "Molinos Cañuelas" muestra el nombre editado, `updateSupplier` funciona — pero esto es una verificación técnica, no de UI.

### 12. Tipear rápido en la búsqueda cancela requests viejos

- Poné `.env.local` en el **Escenario D** (`VITE_MOCK_LATENCY_MS=3000`, `VITE_API_DEBUG=true`), reiniciá el servidor.
- Abrí la consola, andá a `/proveedores` (esperá a que cargue la primera vez con normalidad).
- En el buscador, tipeá rápido una palabra de varias letras (ej. "arcor", sin pausas entre letras — importa que sea rápido, más rápido que el debounce de 300ms entre teclas, para que se disparen varios fetches).
- **Qué deberías ver en consola:** varias líneas `req-N start`, pero SOLO la última debería llegar a `resolved` — las anteriores deberían mostrar `req-N cancelled` (no `error`, `cancelled` es un evento distinto) antes de que pasen los 3000ms completos de latencia simulada.
- **Si no pasa esto:** si ves que TODAS las líneas `start` llegan a `resolved` (ninguna se cancela), el `AbortController` no está cortando los fetches viejos — revisar `usePagedQuery.ts`/`httpClient.ts`. Si no ves ninguna línea de más de un `start` (solo una petición se dispara en total), el debounce de 300ms ya está absorbiendo todo antes de llegar a `httpClient` — probá tipeando todavía más rápido, o cada letra con menos de 300ms de diferencia.

Volvé a poner el Escenario A (normal) en `.env.local` y reiniciá el servidor cuando termines.

### 13. Cambiar de sucursal NO cambia el listado de proveedores

- En `/proveedores`, con la tabla cargada, fijate cuántas/cuáles filas hay.
- Usá el selector de sucursal del Header (arriba, dice "Sucursal / Depósito" con el nombre de la sucursal activa) y cambiá a otra sucursal.
- **Qué deberías ver:** el listado de Proveedores **no cambia en absoluto** — mismas filas, mismo orden, sin ningún parpadeo de recarga. **Esto es el comportamiento correcto, no un bug** — un proveedor es de la empresa, no de una sucursal (decisión confirmada explícitamente antes de esta tanda, ver `DECISIONES_TECNICAS.md`).
- **Si no pasa esto (es decir, si el listado SÍ cambia o se recarga al cambiar de sucursal):** eso sería lo inesperado — avisame, porque significaría que algo quedó escuchando `activeBranchId` sin que debiera.

---

## Tabla de resultados

**Verificación parcial, 04/09/2026.** Se ejecutó el escenario normal (Bloque A, sin variables de entorno especiales) contra la pantalla de Proveedores, con captura de pantalla como evidencia: carga contra la capa `api/` nueva, paginación server-side, orden server-side por las 4 columnas, y alta de proveedor — sin regresiones visuales ni errores observados en esa pantalla. **No se ejecutaron** los escenarios de Tanda 0 (provocar un error de render, puntos 1-5) ni los de Tanda 1 que requieren variables de entorno especiales o interacción específica (latencia alta, fallo forzado, debug de reintentos, deep-link, cancelación por tipeo rápido, cambio de sucursal — puntos 7, 8, 9, 10, 12, 13). Esos escenarios siguen disponibles tal como están documentados arriba, con las mismas variables de `.env.local.ejemplo-verificacion` — no requieren ningún cambio de código para probarse cuando se retome la verificación.

| Punto | Resultado | Notas |
|---|---|---|
| 1. Fallback del boundary aparece | No ejecutado | No se provocó ningún error de render en esta sesión de verificación. |
| 2. Resto de la app sigue viva | No ejecutado | Depende de provocar el error del punto 1 primero. |
| 3. "Reintentar" sin recargar | No ejecutado | Depende de provocar el error del punto 1 primero. |
| 4. Navegar limpia el error | No ejecutado | Depende de provocar el error del punto 1 primero. |
| 5. `logError` en consola | No ejecutado | Depende de provocar el error del punto 1 primero. |
| 6. Listado: carga/pagina/busca/ordena | Verificado (parcial) | Carga contra la capa `api/` nueva confirmada, con captura de pantalla. Paginación server-side OK ("Mostrando 1-4 de 4", "Página 1 de 1", selector de filas por página funcional). Orden server-side OK: indicadores activos en Razón Social, Rubro, CUIT y Saldo Actual. **Búsqueda por texto y filtro de rubro no se probaron** en esta sesión — falta ejercitar esa parte del punto. |
| 7. Latencia alta → `LoadingState` | No ejecutado | No se probó con `VITE_MOCK_LATENCY_MS` alto. |
| 8. Fallo forzado → `ErrorState` + reintento | No ejecutado | No se probó con `VITE_MOCK_FAILURE_RATE=1`. |
| 9. 2 reintentos con backoff en consola | No ejecutado | No se probó con `VITE_API_DEBUG=true` para ver la secuencia de reintentos. |
| 10. Deep-link Proveedores→Compras | No ejecutado | No se probó el flujo "Nueva OC" con proveedor preseleccionado. |
| 11. Alta de proveedor (edición: sin botón, ver aviso) | Verificado (parcial) — alta | Alta confirmada: hay un registro de prueba creado en la sesión ("sass", CUIT 000000) persistido en el mock. Edición sigue sin botón en la UI (ver aviso más arriba en este documento) — no es un caso sin probar, es no aplicable como está la pantalla hoy. |
| 12. Cancelación al tipear rápido | No ejecutado | No se probó tipeo rápido en el buscador para verificar el evento `cancelled` en consola. |
| 13. Cambiar de sucursal no afecta el listado | No ejecutado | No se probó el cambio de sucursal activa. |
