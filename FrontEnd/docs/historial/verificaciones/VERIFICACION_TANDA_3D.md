# Verificación funcional manual — Tanda 3d (Directorio de Clientes migrado)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración del Directorio de Contacto (`ClientsPage.tsx` tab
"Directorio de Contacto" + `ClientDirectoryTable.tsx`) de `useCachedQuery` (todo en
memoria) a `usePagedQuery` (server-side), más la nueva capa `api/` en
`modules/clients/api/`. **Fuera de esta tanda, sin tocar su lógica:** Cuentas
Corrientes y Clientes Morosos — ya migradas en tandas anteriores, esta tanda solo les
cambió la ruta de import (`@/services/mock/clients.service` →
`@/modules/clients/api/clients.service`), sin tocar ningún cálculo (FIFO, aging).

**Servidor de desarrollo:** al final de esta sesión te doy el puerto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar.

**Cómo cambiar de escenario:** igual que en los checklists anteriores — editá
`FrontEnd/.env.local`, reiniciá el servidor, recargá.

---

## Sección A — Directorio de Contacto

### A1. El Directorio carga y pagina

- Andá a **Clientes** (`/clientes`) → tab **"Directorio de Contacto"** (la que abre
  por defecto).
- **Qué deberías ver:** la tabla carga con los clientes del mock y aparecen los
  controles de paginación abajo (`<Pagination>`, nuevo en esta tanda — antes el
  Directorio mostraba todos los clientes filtrados sin paginar).
- **Si no pasa esto:** si la tabla no carga o queda en el estado de carga para
  siempre, revisá la consola por errores.

### A2. Buscar por nombre/CUIT funciona (ahora con un pequeño delay)

- Escribí algo en el buscador de arriba (por ejemplo, parte del nombre de un cliente).
- **Qué deberías ver:** la lista se filtra después de una pausa breve (~300ms, antes
  era instantáneo porque filtraba en memoria) — mientras se resuelve la consulta
  puede verse un overlay de carga sutil sobre la tabla.
- **Si no pasa esto:** si el filtro no aplica, o tarda mucho más de lo esperado,
  avisame.

### A3. Filtrar por Zona/Vendedor/Estado sigue funcionando

- Probá el filtro de **Zona**, después el de **Vendedor**, después el de **Estado**
  (uno por vez, o combinados).
- **Qué deberías ver:** la lista se actualiza acorde a cada filtro, igual que antes
  de esta tanda — ahora resuelto contra el service en vez de en memoria.
- **Si no pasa esto:** si algún filtro deja de aplicar o rompe la lista, avisame.

---

## Sección B — Alta y edición de cliente

### B1. Crear un cliente nuevo funciona y la lista se actualiza sola

- Click en **"Nuevo Cliente"**, completá los campos obligatorios (Razón Social, CUIT
  — cualquier CUIT real, no `30-11111111-1`) y guardá.
- **Qué deberías ver:** un toast de éxito, el modal se cierra, y el cliente nuevo
  aparece en el Directorio **sin necesidad de recargar la página** (la lista se
  vuelve a pedir sola tras guardar).
- **Si no pasa esto:** si el cliente no aparece en la lista tras guardar, avisame.

### B2. Editar un cliente existente funciona igual

- Abrí un cliente existente para editar (si el Directorio tiene esa acción visible),
  cambiá algún dato (por ejemplo el teléfono) y guardá.
- **Qué deberías ver:** toast de éxito y el dato actualizado reflejado en la fila
  correspondiente sin recargar.
- **Si no pasa esto:** avisame qué campo no se actualizó.

### B3. El cliente creado sobrevive a navegar afuera y volver

- Con el cliente del punto B1 ya creado, navegá a **Dashboard** y volvé a
  **Clientes**.
- **Qué deberías ver:** el cliente nuevo **sigue apareciendo** en el Directorio —
  antes de esta tanda esto ya funcionaba (el service viejo ya persistía en memoria
  durante la sesión), así que este punto confirma que la migración no rompió esa
  persistencia ya existente.
- **Si no pasa esto:** si el cliente desapareció, sería una regresión real —
  avisame.

---

## Sección C — Cuentas Corrientes y Clientes Morosos (no deberían haber cambiado)

### C1. Cuentas Corrientes sigue funcionando idéntico

- Andá a tab **"Cuentas Corrientes"**. Probá la búsqueda y el filtro de rango de
  fecha.
- **Qué deberías ver:** exactamente el mismo comportamiento que antes de esta
  tanda — carga, pagina, busca y exporta igual. Esta tanda solo le cambió de dónde
  importa el service, no su lógica.
- **Si no pasa esto:** cualquier diferencia acá sería una regresión — avisame.

### C2. Clientes Morosos sigue funcionando idéntico, con los mismos tramos de aging

- Andá a tab **"Clientes Morosos"**. Mirá los tramos de antigüedad (1-30, 31-60,
  61-90, 90+) y sus montos/contadores.
- **Qué deberías ver:** los mismos números que verías si compararas contra antes de
  esta tanda (la lógica FIFO/aging se copió literal, sin cambios).
- **Si no pasa esto:** si algún tramo muestra un monto o un contador distinto al
  esperado, avisame — sería indicio de que algo de la lógica copiada sí cambió.

### C3. El cliente nuevo del punto B1 aparece correctamente en las otras dos pestañas

- Con el cliente creado en B1 (que arranca "Al día", sin deuda, saldo en cero), andá
  a **Cuentas Corrientes** y buscalo por nombre.
- **Qué deberías ver:** aparece en Cuentas Corrientes con saldo $0 y sin mora. **No**
  debería aparecer en **Clientes Morosos** (no tiene ninguna factura vencida) — si
  aparece ahí, avisame porque sería un bug.
- **Si no pasa esto:** si no aparece en Cuentas Corrientes, o aparece en Morosos,
  avisame.

---

## Tabla de resultados

**Sin ejecutar, 04/09/2026.** El commit de esta tanda se autorizó en base a `tsc -b`,
`npm run lint` y `npm run build` limpios, el diff línea por línea que confirma que la
lógica FIFO/aging se copió sin cambios, y el análisis de código — sin correr este
checklist en el navegador. Quedan sin confirmar en particular los puntos que prueban
que Cuentas Corrientes y Clientes Morosos siguen funcionando igual tras la absorción
del service (C1, C2, C3). El checklist sigue vigente y ejecutable tal cual está
escrito arriba cuando se retome.

| Punto | Resultado | Notas |
|---|---|---|
| A1. Directorio carga y pagina | No ejecutado | |
| A2. Buscar por nombre/CUIT funciona (con delay) | No ejecutado | |
| A3. Filtrar por Zona/Vendedor/Estado funciona | No ejecutado | |
| B1. Crear cliente funciona y la lista se actualiza sola | No ejecutado | |
| B2. Editar cliente funciona igual | No ejecutado | |
| B3. Cliente creado sobrevive a navegar afuera y volver | No ejecutado | |
| C1. Cuentas Corrientes sigue funcionando idéntico | No ejecutado | |
| C2. Clientes Morosos sigue funcionando idéntico (aging correcto) | No ejecutado | |
| C3. Cliente nuevo aparece bien en las otras dos pestañas | No ejecutado | |
