# Verificación funcional manual — Tanda 3g (Movimientos + Historial del Producto)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración de las tabs "Movimientos" (`TabMovements.tsx`) e "Historial
del Producto" (`TabProductHistory.tsx`) de `InventoryPage.tsx`, de recibir el array
completo por props (sin filtrar por sucursal — `InventoryMovement`/`ProductHistoryEvent`
no tenían `branchId` antes de esta tanda) a autoconsultarse con `usePagedQuery`, filtradas
por la sucursal activa. Ambas pasan a vivir en `modules/inventory/api/movements/` y
`modules/inventory/api/product-history/`. **Fuera de esta tanda, sin tocar:** Reposición
(`TabPurchases`) — esa es la Tanda 3f.

**Lo nuevo de fondo:** antes de esta tanda, cambiar de sucursal NO afectaba ni a
Movimientos ni a Historial — mostraban siempre el mismo array completo, sin importar la
sucursal activa. Ahora sí filtran por sucursal — esto es lo más importante a confirmar
(puntos 3 y 4 de abajo).

**Servidor de desarrollo:** al final de esta sesión te doy el puerto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar.

**Cómo cambiar de escenario:** igual que en los checklists anteriores — editá
`FrontEnd/.env.local`, reiniciá el servidor, recargá.

---

## Sección A — Movimientos

### A1. Movimientos carga, pagina y ordena

- Andá a **Inventario** (`/inventario`) → tab **"Movimientos"**.
- **Qué deberías ver:** la tabla carga con los movimientos de la sucursal activa
  (Sucursal Centro por defecto), ordenados por Fecha, del más reciente al más antiguo.
- Hacé click en los encabezados **"Fecha"**, **"Producto"** y **"Cant."**.
- **Qué deberías ver:** la lista se reordena en cada click (el ícono de flecha cambia de
  dirección al hacer click de nuevo en la misma columna).
- Si hay más de una página (depende de cuántos movimientos tenga la sucursal activa),
  probá los controles de `<Pagination>` de abajo.
- **Si no pasa esto:** si la tabla no carga, no ordena, o los controles de paginación no
  aparecen, revisá la consola por errores.

---

## Sección B — Historial del Producto

### B1. Historial carga, pagina, busca y ordena

- Andá a tab **"Historial del Producto"**.
- **Qué deberías ver:** la tabla carga con los eventos de la sucursal activa, ordenados
  por Fecha (más reciente primero).
- Escribí algo en el buscador de arriba (por SKU o nombre de producto, ej. "Aceite").
- **Qué deberías ver:** la lista se filtra después de una pausa breve (~300ms) — mientras
  se resuelve la consulta puede verse un overlay de carga sutil sobre la tabla.
- Borrá la búsqueda y hacé click en los encabezados **"Fecha"** y **"Producto"**.
- **Qué deberías ver:** la lista se reordena en cada click.
- **Si no pasa esto:** si no carga, no filtra, o no ordena, revisá la consola por
  errores.

---

## Sección C — Filtrado por sucursal (lo nuevo de esta tanda)

### C1. Cambiar de sucursal cambia los registros de AMBAS tabs

- Con **"Movimientos"** abierto, anotá los SKU/fechas que ves.
- Cambiá de sucursal desde el selector del header (probá las 3 sucursales activas:
  Centro, Norte, Sur).
- **Qué deberías ver:** la lista de Movimientos cambia — otros registros, no los mismos
  reordenados.
- Repetí lo mismo en **"Historial del Producto"**.
- **Qué deberías ver:** la lista de Historial también cambia al cambiar de sucursal.
- **Si no pasa esto:** si alguna de las dos tabs muestra siempre los mismos registros sin
  importar la sucursal, avisame — sería un bug real (el filtro de sucursal no se estaría
  aplicando).

### C2. Los registros de una sucursal no aparecen en otra

- Anotá los `id` (o SKU + fecha, como referencia visual) de los movimientos que ves en
  **Sucursal Centro**.
- Cambiá a **Sucursal Norte** y después a **Sucursal Sur**.
- **Qué deberías ver:** ninguno de los movimientos de Sucursal Centro reaparece en las
  otras dos — cada sucursal tiene su propio conjunto, sin superposición. Mismo chequeo
  para Historial del Producto.
- **Si no pasa esto:** si ves el mismo registro repetido en más de una sucursal, avisame.

---

## Tabla de resultados

| Punto | Resultado | Notas |
|---|---|---|
| A1. Movimientos carga, pagina y ordena | No ejecutado | Checklist vigente, pendiente de correr en navegador. |
| B1. Historial carga, pagina, busca y ordena | No ejecutado | Checklist vigente, pendiente de correr en navegador. |
| C1. Cambiar de sucursal cambia los registros de AMBAS tabs | No ejecutado | **Este es el punto que prueba la ampliación del modelo** (`branchId` agregado a `InventoryMovement`/`ProductHistoryEvent` en esta tanda) — verificado por script contra los datos del mock (filtrado disjunto 3/3/2 por sucursal, ver `DECISIONES_TECNICAS.md`), pero NO en el navegador todavía. |
| C2. Los registros de una sucursal no aparecen en otra | No ejecutado | **Mismo motivo que C1** — es la otra mitad de la prueba de la ampliación del modelo. El script confirmó conjuntos disjuntos (ningún `id` repetido entre sucursales) sobre los datos crudos del mock, pero eso no reemplaza confirmar que la tabla en pantalla se comporta igual. |
