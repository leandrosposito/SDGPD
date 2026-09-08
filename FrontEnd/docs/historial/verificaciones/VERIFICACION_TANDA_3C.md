# Verificación funcional manual — Tanda 3c (3 vistas de Configuración migradas)

**Quién ejecuta esto:** vos, en el navegador. No requiere leer código — cada punto dice
exactamente qué hacer y qué mirar.

**Qué cubre:** la migración de las 3 vistas de `settings` a la capa `api/` +
`httpClient` — Usuarios y Roles (`usePagedQuery` para el directorio,
`useCachedQuery` para la matriz de permisos), Suscripción (`usePagedQuery` para el
historial de cobros), y Auditoría (`useCachedQuery`, feed chico sin paginación).
**Fuera de esta tanda, sin tocar:** las tabs "Perfil Empresa", "Comercial",
"Preferencias" y el widget "Backup" — son decorativos (sin ningún `onClick`), no
tenían datos reales que migrar.

**Servidor de desarrollo:** al final de esta sesión te doy el puerto — hacé
**hard refresh** (Ctrl+Shift+R) antes de empezar.

**Cómo cambiar de escenario:** igual que en los checklists anteriores — editá
`FrontEnd/.env.local`, reiniciá el servidor, recargá.

---

## Sección A — Usuarios y Roles

### A1. El Directorio de Usuarios carga y pagina

- Andá a **Configuración** (`/settings`) → tab **"Usuarios y Roles"**.
- **Qué deberías ver:** la tabla "Directorio de Usuarios" carga con los 5 usuarios del
  mock, y aparecen los controles de paginación abajo (`<Pagination>`, nuevo en esta
  tanda).
- **Aviso, no es un bug:** no hay buscador ni filtro acá — no existían antes de esta
  migración, no se agregaron.
- **Si no pasa esto:** si la tabla no carga, revisá la consola por errores.

### A2. La Matriz de Permisos carga y el toggle funciona de verdad

- Debajo del directorio, mirá la "Matriz de Permisos por Rol" — debería cargar con
  los 4 roles (Admin, Vendedor, Chofer, Deposito) y sus casilleros marcados/vacíos
  según el mock.
- Click en cualquier casillero (por ejemplo, activar "Caja" para "Vendedor").
- **Qué deberías ver:** el casillero cambia al instante (de vacío a tildado o
  viceversa) — es una mutación real contra el service ahora, no un toggle solo
  visual.
- **Si no pasa esto:** si el click no cambia nada, o tira un error en consola,
  avisame.

### A3. El cambio de permiso sobrevive a navegar afuera y volver

- Con el cambio del punto A2 ya hecho, navegá a **Dashboard** y volvé a
  **Configuración → Usuarios y Roles**.
- **Qué deberías ver:** el casillero que cambiaste **sigue como lo dejaste** — antes
  de esta tanda, el toggle mutaba una referencia compartida del mock de forma
  accidental (funcionaba "por casualidad", no por diseño); ahora es una mutación real
  contra el store del service.
- **Si no pasa esto:** si el permiso volvió a su valor original, avisame — sería un
  regresión real.

### A4. Botones decorativos siguen sin hacer nada — no es un bug

- "Nuevo Usuario", "Password", "2FA" (en la tabla de usuarios) y "Guardar Matriz"
  (debajo de la matriz) **no deberían hacer nada** al clickearlos — eran botones sin
  ninguna acción antes de esta tanda, y siguen así a propósito (no se les inventó
  una función). Si alguno de estos SÍ hace algo, avisame porque no debería.

---

## Sección B — Suscripción

### B1. El Historial de Cobros carga y pagina

- Andá a tab **"Suscripción"**.
- **Qué deberías ver:** la card "Plan Actual" (Premium, información de facturación)
  se ve exactamente igual que siempre — es texto fijo, no se tocó. Al lado, la tabla
  "Historial de Cobros" carga con las 3 facturas del mock, ordenadas de más reciente
  a más antigua, con los controles de paginación abajo (nuevos en esta tanda).
- **Si no pasa esto:** si la tabla de facturas no carga, revisá la consola.

### B2. "Actualizar Medio de Pago" sigue sin hacer nada — no es un bug

- Click en el botón — no debería pasar nada, es decorativo desde antes de esta
  tanda, no se le agregó ninguna acción.

---

## Sección C — Auditoría

### C1. El widget de Auditoría carga

- En cualquier tab de Configuración, mirá la columna derecha ("Registro de
  Auditoría", junto al widget de Backup).
- **Qué deberías ver:** las 4 entradas del mock, en el mismo orden de siempre (más
  reciente arriba: "Hace 5 min", "Hace 1 hora", "Ayer", "Hace 2 días").
- **Aviso, no es un bug:** este widget no tiene paginación ni "cargar más" —
  siempre fue un feed chico de sidebar, no una tabla completa, y sigue así.
- **Si no pasa esto:** si el widget no carga nada o queda en el estado de carga para
  siempre, revisá la consola.

---

## Tabla de resultados

**Sin ejecutar, 04/09/2026.** El commit de esta tanda se autorizó en base a `tsc -b`,
`npm run lint` y `npm run build` limpios más el análisis de código, sin correr este
checklist en el navegador. El checklist sigue vigente y ejecutable tal cual está
escrito arriba cuando se retome.

| Punto | Resultado | Notas |
|---|---|---|
| A1. Directorio de Usuarios carga y pagina | No ejecutado | |
| A2. Toggle de permiso funciona de verdad | No ejecutado | |
| A3. Cambio de permiso sobrevive a navegar afuera y volver | No ejecutado | |
| A4. Botones decorativos de Usuarios/Roles siguen sin hacer nada | No ejecutado | |
| B1. Historial de Cobros carga y pagina | No ejecutado | |
| B2. "Actualizar Medio de Pago" sigue sin hacer nada | No ejecutado | |
| C1. Widget de Auditoría carga | No ejecutado | |
