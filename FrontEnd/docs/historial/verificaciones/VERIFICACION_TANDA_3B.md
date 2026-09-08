# Verificación funcional manual — Tanda 3b (módulo Caja migrado)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración completa de `cash` (Caja) a la capa `api/` +
`usePagedQuery` + `httpClient` — segundo módulo migrado sin service previo (después de
`orders`, Tanda 3a). Cierra por completo el ítem 8 de `docs/PENDIENTES.md`: las
mutaciones (crear un movimiento) ya no deberían perderse al navegar afuera y volver.

**Servidor de desarrollo:** al final de esta sesión te doy el puerto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar.

**Cómo cambiar de escenario:** igual que en los checklists anteriores — editá
`FrontEnd/.env.local`, reiniciá el servidor, recargá.

---

### 1. El listado de Caja carga, pagina, busca y filtra

- Andá a **Caja** (`/caja`).
- **Qué deberías ver:** el "Libro Diario" carga con las 6 transacciones del mock,
  ordenadas por hora descendente (la más reciente arriba), y aparecen los controles
  de paginación abajo (`<Pagination>`, nuevo en esta tanda).
- **Aviso, no es un bug:** `CashPage` **nunca tuvo** buscador ni filtros (a diferencia
  de Pedidos/Proveedores) — no se agregaron en esta tanda porque no existían antes.
  Si esperabas un buscador acá, es una ausencia preexistente, no algo que esta
  migración debiera haber agregado.
- **Si no pasa esto:** si la tabla no carga nada o queda en el estado de carga para
  siempre, revisá la consola por errores.

### 2. Los saldos y totales son correctos y se calculan server-side

- Con la caja cargada, anotá los 4 valores de arriba: Saldo Inicial, Ingresos, Egresos,
  Saldo Actual.
- **Qué deberías ver:** Saldo Inicial = $50.000 (fijo, no cambia). Ingresos = suma de
  las transacciones tipo "Ingreso" visibles en la tabla. Egresos = suma de las tipo
  "Egreso". Saldo Actual = Saldo Inicial + Ingresos − Egresos.
- Mirá también el widget "Análisis de Gastos" — las categorías que aparecen ahí y sus
  montos/porcentajes ahora se calculan de verdad sobre los egresos reales (antes eran
  3 categorías fijas del mock, nunca recalculadas). El porcentaje "+20% vs mes
  anterior" sigue siendo un valor fijo (no hay datos de un mes anterior para comparar
  de verdad) — **no es un bug**, ya lo era antes de esta tanda.
- **Si no pasa esto:** si algún total no cierra con la suma real de las transacciones
  visibles, avisame con los números exactos.

### 3. Crear un movimiento funciona y aparece en el listado

- Click en **"+ Nuevo Movimiento"**.
- Completá el formulario: tipo (Ingreso/Egreso), categoría, entidad, monto, forma de
  pago, descripción.
- Click en **"Guardar y Cerrar"**.
- **Qué deberías ver:** un toast de éxito, el modal se cierra, y el movimiento nuevo
  aparece en el Libro Diario **sin recargar la página** — arriba de todo (más reciente
  por hora). Los 4 totales de arriba (Ingresos/Egresos/Saldo Actual) deberían
  actualizarse para reflejarlo.
- Probá también **"Guardar y Cargar Otro"** — debería guardar el movimiento, limpiar
  el formulario (menos tipo/categoría) y dejar el modal abierto para cargar uno nuevo.
- **Si no pasa esto:** si el movimiento no aparece o los totales no se actualizan, la
  invalidación/`refetch()` no está funcionando.

### 4. El movimiento creado sigue ahí después de navegar afuera y volver

**Este es el punto central de la tanda.**

- Con el movimiento de prueba del punto 3 ya creado y visible, navegá a **Dashboard**
  (o cualquier otra pantalla).
- Volvé a **Caja**.
- **Qué deberías ver:** el movimiento de prueba **sigue en el Libro Diario**, y los
  totales siguen reflejándolo — antes de esta tanda, como el estado vivía en un
  `useState` local de `CashPage`, cualquier alta se perdía al desmontar el componente.
- **Si no pasa esto:** si el movimiento de prueba desapareció al volver, el fix no
  funcionó — es el hallazgo más importante para reportar si falla.

### 5. Cambiar de sucursal no afecta el listado de Caja

- Con la caja cargada, anotá cuántas transacciones hay.
- Cambiá de sucursal con el selector del Header.
- **Qué deberías ver:** el listado de Caja **no cambia en absoluto** — mismas filas,
  sin ningún parpadeo de recarga. Es el comportamiento correcto (no un bug): una caja
  es de la empresa, no de una sucursal — confirmado explícitamente antes de
  implementar esta tanda (la hipótesis inicial asumía sucursal; el código no tenía
  ninguna evidencia de eso).
- **Si no pasa esto** (el listado SÍ cambia o se recarga al cambiar de sucursal): eso
  sería inesperado, avisame.

### 6. El campo de hora del modal acepta y muestra bien el valor

- Abrí **"+ Nuevo Movimiento"** y mirá el campo "Fecha y Hora".
- **Qué deberías ver:** el campo ya viene precargado con la hora actual, en formato
  24hs (`HH:mm`, ej. `14:30`), y el selector nativo del navegador (el reloj que
  aparece al hacer click) funciona con normalidad — sin errores de formato ni el
  campo vacío.
- Cambiá manualmente el valor del campo (o dejalo como está) y guardá el movimiento —
  la hora que quede en la tabla debería coincidir con la que pusiste.
- **Nota:** este bug se había reportado antes, pero al revisar el código dos veces
  (antes y durante esta tanda) se confirmó que **no reproduce** — el código ya usa
  `hour12: false` explícito, compatible con el input nativo. Este punto es para que
  vos lo confirmes en la práctica, no porque se haya corregido algo en esta tanda.
- **Si no pasa esto** (el campo aparece vacío, con AM/PM, o el selector nativo se
  queja del formato): sería la primera vez que se confirma el bug — avisame con
  capturas si podés.

---

## Tabla de resultados

**Sin ejecutar, 04/09/2026.** El commit de esta tanda se autorizó en base a `tsc -b`,
`npm run lint` y `npm run build` limpios más el análisis de código, sin correr este
checklist en el navegador. El checklist sigue vigente y ejecutable tal cual está
escrito arriba cuando se retome — ninguno de los 6 puntos, incluido el punto 4 (el
objetivo central de esta tanda: que un movimiento creado sobreviva a navegar afuera y
volver, lo que cierra el ítem 8 de `PENDIENTES.md` para Caja), fue confirmado todavía.

| Punto | Resultado | Notas |
|---|---|---|
| 1. Listado carga/pagina (sin buscador/filtros, no existían antes) | No ejecutado | |
| 2. Saldos y totales correctos, calculados server-side | No ejecutado | |
| 3. Crear movimiento funciona y aparece en el listado | No ejecutado | |
| 4. Movimiento creado sobrevive a navegar afuera y volver | No ejecutado | Objetivo central de la tanda — el cierre del ítem 8 de `PENDIENTES.md` (parte Caja) es por código, no por verificación funcional confirmada. |
| 5. Cambiar de sucursal no afecta el listado | No ejecutado | |
| 6. Campo de hora funciona correctamente (24h) | No ejecutado | |
