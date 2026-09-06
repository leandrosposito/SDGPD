# Verificación funcional manual — Tanda 3e (Stock Actual + capa api/ de Productos)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración de "Stock Actual" (`InventoryPage.tsx` tab "Stock Actual"
+ `TabStockCurrent.tsx`) de recibir datos por props (ya traídos completos por el
padre) a autoconsultarse con `usePagedQuery`, más la nueva capa `api/` de productos
en `shared/api/products/` (reemplaza a `src/services/mock/products.service.ts`,
consumido también por Compras y Pedidos). Suma dos correcciones posteriores al
commit inicial, encontradas al verificar: un bug de conteo entre "Stock Bajo" y
"Bajo Stock Mínimo" (Sección A3) y búsqueda + orden por columna en "Bajo Stock
Mínimo" (Sección D, no existían antes). **Fuera de esta tanda, sin tocar:**
Reposición (`TabPurchases`), Movimientos y Historial del Producto — esas son las
tandas 3f y 3g.

**Servidor de desarrollo:** al final de esta sesión te doy el puerto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar.

**Cómo cambiar de escenario:** igual que en los checklists anteriores — editá
`FrontEnd/.env.local`, reiniciá el servidor, recargá.

---

## Sección A — Stock Actual

### A1. Stock Actual carga, pagina y busca

- Andá a **Inventario** (`/inventario`) → tab **"Stock Actual"** (la que abre por
  defecto).
- **Qué deberías ver:** la tabla carga con los productos de la sucursal activa y
  aparecen los controles de paginación abajo (`<Pagination>`).
- Escribí algo en el buscador de arriba (por nombre, SKU, código de barras o
  descripción).
- **Qué deberías ver:** la lista se filtra después de una pausa breve (~300ms) —
  mientras se resuelve la consulta puede verse un overlay de carga sutil sobre la
  tabla.
- **Si no pasa esto:** si la tabla no carga, o el buscador no filtra nada, revisá
  la consola por errores.

### A2. Los 4 KPIs son correctos y NO cambian al pasar de página

- Con el buscador vacío, anotá los 4 números de arriba: **Total Productos**,
  **Stock Bajo**, **Sin Stock**, **Valor Inventario**.
- Cambiá de página (o de tamaño de página) con los controles de abajo.
- **Qué deberías ver:** los 4 números de arriba **NO cambian** al cambiar de
  página — reflejan el total de la sucursal completa (filtrada por la búsqueda
  vigente, si hay alguna), no solo las filas visibles.
- **Si no pasa esto:** si algún KPI cambia al pasar de página, avisame — sería un
  bug real (el agregado se estaría calculando sobre la página, no sobre todo el
  filtro).

### A3. El conteo de "Stock Bajo" coincide con Bajo Stock Mínimo

- Anotá el número de la tarjeta **"Stock Bajo"** de Stock Actual (con el buscador
  vacío).
- Andá a la tab **"Bajo Stock Mínimo"** y mirá el contador de arriba ("N
  productos").
- **Qué deberías ver:** los dos números **coinciden exactamente** — las dos
  pantallas usan el mismo criterio de "bajo stock" (stock menor o igual al
  mínimo).
- **Chequeo extra (esto es lo que estaba mal antes del fix):** fijate si en la
  sucursal activa hay algún producto con **stock en 0 y mínimo definido mayor a
  0** (ej. "Vino Tinto" en Sucursal Centro o Sucursal Norte, mock actual). Ese
  producto tiene que aparecer contado en LAS DOS pantallas: en la tarjeta **"Sin
  Stock"** de Stock Actual (porque su stock es 0) Y también en el número de
  **"Stock Bajo"** de Stock Actual (porque 0 es menor o igual a su mínimo) Y en
  el contador de **"Bajo Stock Mínimo"**. Antes del fix, ese producto contaba
  como "Sin Stock" pero NUNCA como "Stock Bajo" — por eso los dos números de
  arriba (Stock Bajo vs. Bajo Stock Mínimo) daban distinto (12 vs. 13 en
  Sucursal Centro). Si volvés a ver esa diferencia, avisame.
- **Si no pasa esto:** si los números difieren, avisame — es exactamente el caso
  que esta tanda quería evitar.

---

## Sección B — Alta, edición y baja de producto

### B1. Crear, editar y borrar un producto se refleja en Stock Actual y en Bajo Stock Mínimo

- Click en **"Nuevo Producto"**, completá los campos obligatorios y guardá.
- **Qué deberías ver:** toast de éxito, y el producto nuevo aparece en Stock Actual
  sin necesidad de recargar la página (empieza con stock 0 en todas las
  sucursales, así que probablemente aparezca también en Bajo Stock Mínimo si el
  mínimo definido es mayor a 0 — o quedará "Sin Stock" en Stock Actual).
- Editá ese mismo producto (cambiá el nombre o el costo) y guardá.
- **Qué deberías ver:** el cambio se refleja en la fila de Stock Actual sin
  recargar.
- Andá a la tab **"Bajo Stock Mínimo"** sin recargar la página — si el producto
  nuevo aplica (stock <= mínimo), debería aparecer ahí también.
- Borrá el producto (desde el modal de edición, botón "Eliminar").
- **Qué deberías ver:** desaparece de Stock Actual y de Bajo Stock Mínimo sin
  recargar.
- **Si no pasa esto:** si algún cambio no se refleja hasta que recargás la página
  a mano, avisame — la invalidación de cache no estaría funcionando.

### B2. Cambiar de sucursal actualiza el stock correctamente

- Con Stock Actual abierto, cambiá de sucursal desde el selector del header.
- **Qué deberías ver:** la tabla se recarga con el stock de la nueva sucursal
  (números de stock distintos para los mismos productos), y los 4 KPIs también
  se recalculan para la sucursal nueva.
- **Si no pasa esto:** si el stock no cambia al cambiar de sucursal, avisame.

### B3. "Ver Lotes" sigue abriendo el panel con los datos del producto correcto

- En cualquier fila de Stock Actual, click en **"Ver Lotes"**.
- **Qué deberías ver:** se abre el panel lateral con el SKU/nombre del producto
  correcto, y sus lotes (si tiene) con vencimiento y estado (OK/Próximo a
  vencer/Vencido). Probá con "Aceite de Girasol 1.5L" o "Yerba Mate 1kg Paquete"
  (los dos productos del mock que sí tienen lotes cargados).
- **Si no pasa esto:** si el panel abre vacío para un producto que debería tener
  lotes, o muestra los lotes de otro producto, avisame.

---

## Sección C — Compras y Pedidos (no deberían haber cambiado)

### C1. Compras sigue cargando el catálogo de productos sin errores

- Andá a **Compras** (`/compras`). Abrí el modal de "Nueva Orden de Compra" (o el
  flujo que use el buscador de productos).
- **Qué deberías ver:** el catálogo de productos carga igual que siempre — sin
  errores en consola, sin demoras nuevas.
- Si tenés a mano el flujo de "Generar OC" desde Bajo Stock Mínimo de Inventario
  (botón en una fila con déficit), probalo también: debería seguir armando la
  orden con el producto/proveedor/cantidad correctos.
- **Si no pasa esto:** cualquier error en consola relacionado a "products" acá
  sería una regresión — avisame.

### C2. Pedidos sigue cargando el catálogo de productos sin errores

- Andá a **Pedidos** (`/pedidos`) → **"Nuevo Pedido"**.
- **Qué deberías ver:** la sección de productos carga el catálogo igual que
  siempre. Buscá un producto por SKU o código de barras y agregalo al pedido —
  el stock que se muestra debería ser el de la sucursal activa.
- **Si no pasa esto:** cualquier error en consola relacionado a "products" acá
  sería una regresión — avisame.

### C3. Bajo Stock Mínimo — paginar, solicitar reposición y Generar OC siguen funcionando

- Andá a tab **"Bajo Stock Mínimo"**. Probá paginar, y (si tenés algún producto
  con reposición pendiente) probá "Solicitar reposición" y "Generar OC".
- **Qué deberías ver:** el mismo comportamiento de siempre en paginación,
  "Solicitar reposición" y "Generar OC" — lo que SÍ cambió en esta tab son
  búsqueda y orden, cubiertos en la Sección D de abajo.
- **Si no pasa esto:** cualquier diferencia acá sería una regresión — avisame.

---

## Sección D — Bajo Stock Mínimo: búsqueda y orden (nuevo, post-Tanda 3e)

Hallazgo funcional tuyo al verificar la tanda: esta tab no tenía búsqueda ni
orden por columna, a diferencia de Stock Actual. Se agregaron acá.

### D1. Búsqueda por nombre o SKU, server-side y debounced

- En **"Bajo Stock Mínimo"**, escribí en el buscador de arriba (nombre, SKU,
  código de barras o descripción — mismos 4 campos que Stock Actual).
- **Qué deberías ver:** la lista se filtra después de una pausa breve
  (~300ms), igual que en Stock Actual. El contador ("N productos") de arriba
  cambia para reflejar SOLO lo que matchea la búsqueda.
- **Si no pasa esto:** si no filtra nada o tarda de más, avisame.

### D2. Orden por columna clickeable: Nombre, Stock Actual, Stock Mínimo, Déficit

- Hacé click en cada uno de esos 4 encabezados de columna.
- **Qué deberías ver:** la lista se reordena (icono de flecha cambia de
  dirección al hacer click de nuevo en la misma columna para invertir el
  orden), igual que ya funciona en Proveedores.
- **Si no pasa esto:** si algún encabezado no ordena, o el orden se ve mal
  (ej. números como texto), avisame.

### D3. El conteo de Bajo Stock Mínimo con búsqueda activa NO se compara contra "Stock Bajo" de Stock Actual

- Escribí algo en el buscador de **Bajo Stock Mínimo** (que filtre a menos
  productos que el total).
- **Qué deberías ver:** el contador de arriba baja a reflejar solo la
  búsqueda — **NO tiene que coincidir** con "Stock Bajo" de Stock Actual
  mientras haya una búsqueda activa acá. Las dos tabs tienen buscadores
  independientes (cada una con su propio texto escrito), así que sus
  conteos solo son comparables cuando NINGUNA de las dos tiene una búsqueda
  activa (ver A3). Esto es esperado, no un bug.
- **Si no pasa esto:** si el número de "Bajo Stock Mínimo" no cambia al
  buscar (se queda en el total sin filtrar), sí avisame — ese sería un bug
  real.

---

## Tabla de resultados

| Punto | Resultado | Notas |
|---|---|---|
| A1. Stock Actual carga, pagina y busca | No ejecutado | |
| A2. Los 4 KPIs son correctos y no cambian al pasar de página | No ejecutado | |
| A3. "Stock Bajo" coincide con el total de Bajo Stock Mínimo (con AMBOS buscadores vacíos) | Verificado | Leandro confirmó en navegador que los dos números coinciden tras el fix del conteo (12 vs 13 → 13/13). El chequeo extra del punto (producto en 0 con mínimo > 0 contado en las 3 tarjetas) no se registró por separado. |
| B1. Crear/editar/borrar producto se refleja en Stock Actual y Bajo Stock | No ejecutado | |
| B2. Cambiar de sucursal actualiza el stock correctamente | No ejecutado | |
| B3. "Ver Lotes" abre el panel con los datos del producto correcto | No ejecutado | |
| C1. Compras sigue cargando el catálogo sin errores | No ejecutado | |
| C2. Pedidos sigue cargando el catálogo sin errores | No ejecutado | |
| C3. Bajo Stock Mínimo: paginar/solicitar reposición/Generar OC siguen igual | No ejecutado | |
| D1. Bajo Stock Mínimo: búsqueda por nombre/SKU, server-side y debounced | No ejecutado | Sección nueva, agregada junto con el fix de A3. |
| D2. Bajo Stock Mínimo: orden por Nombre/Stock Actual/Stock Mínimo/Déficit | No ejecutado | Sección nueva, agregada junto con el fix de A3. |
| D3. Conteo con búsqueda activa no se compara contra Stock Bajo (comportamiento esperado) | No ejecutado | Sección nueva, agregada junto con el fix de A3. |

**Hallazgo adicional de Leandro, fuera de esta tabla (no es un punto del checklist original):** detectó un segundo producto en 0 sin aparecer donde esperaba — diagnosticado como `inv-019` ("Producto Descontinuado 500g"), sin registro de stock en ninguna sucursal. Comportamiento correcto de la regla E5 (sin registro = sin mínimo definido, no puede estar "bajo mínimo"), no un bug. Ver `DECISIONES_TECNICAS.md` punto 12 y `PENDIENTES.md`.
