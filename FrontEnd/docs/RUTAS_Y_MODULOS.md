# Rutas y Módulos — SDGPD Frontend

## [25/08/2026] — Estándar de Rutas y Módulos Funcionales

### 1. Configuración de rutas
El proyecto utiliza una arquitectura SPA con eact-router-dom. La configuración central de rutas reside exclusivamente en src/shared/routes/AppRoutes.tsx. Este es el único lugar donde se declaran las rutas de la aplicación.

### 2. Cómo agregar una nueva ruta
Para registrar un nuevo módulo o pantalla en la aplicación:
1. Asegurarse de que la vista exporte un componente de página válido.
2. Importar dicho componente en src/shared/routes/AppRoutes.tsx.
3. Agregar un <Route path="ruta" element={<Componente />} /> dentro del bloque <Routes> de AppRoutes.tsx.

### 3. Arquitectura estándar de un módulo funcional
Todo módulo de negocio del ERP vive en src/modules/<nombre-del-modulo>/ y sigue esta estructura interna:

| Subcarpeta | Responsabilidad |
|---|---|
| iews/ | Vistas/páginas propias del módulo |
| components/ | Componentes usados exclusivamente dentro de este módulo (si un componente se necesita en más de un módulo, se promueve a src/shared/components/) |
| services/ | Llamadas a API y lógica de acceso a datos específica del dominio |
| 	ypes/ | Tipos e interfaces del dominio de este módulo |
| index.ts | Barrel público: solo se exporta lo que otros módulos/rutas necesitan consumir |

### 4. Cómo crear un nuevo módulo funcional
1. Duplicar la estructura de src/modules/_template/ con el nombre del nuevo dominio (ej. entas, compras).
2. Declarar sus vistas dentro de iews/ y conectarlas al sistema de rutas central según el estándar de la sección 2.
3. No importar directamente entre módulos (modules/A no debe importar código interno de modules/B); si dos módulos necesitan compartir algo, ese elemento se promueve a src/shared/.

### 5. Cambios realizados en esta etapa
- Se migró la declaración de rutas centralizadas de src/router/AppRouter.tsx hacia su ubicación definitiva transversal src/shared/routes/AppRoutes.tsx.
- Se creó el template estructural en src/modules/_template/ con sus 4 carpetas base y barrel index.

## [28/08/2026] — Primer `services/` real de un módulo, y carpeta `state/` para stores de zustand

### 1. Contexto
`logistics` reemplaza su tablero Kanban por una tabla paginada de "Entregas del Día" (ver `COMPONENTES_Y_LAYOUTS.md` y `DECISIONES_TECNICAS.md` para el detalle). Esta es la primera vez que un módulo real usa la carpeta `services/` tal como la define la sección 3 de este documento, y la primera vez que el proyecto agrega estado con `zustand` — así que acá queda fijada la convención de dónde vive ese estado.

### 2. `services/` — primer uso real
`src/modules/logistics/services/deliveries.service.ts` expone `getDeliveriesForDate(deliveries, date)`: filtra en memoria sobre el mock hoy, pero la firma (recibe los datos y la fecha, devuelve el resultado) es la misma que tendría una llamada real a una API — el día que exista, solo cambia la implementación interna de la función, no quién la llama ni cómo.

### 3. `state/` — convención para stores de zustand dentro de un módulo
Cuando un store de zustand es específico de un módulo (no compartido), vive en `src/modules/<modulo>/state/use<Nombre>Store.ts` — mismo nombre de carpeta (`state/`) que usaría en `src/shared/state/` si en el futuro se promueve a compartido, para que esa migración sea mover el archivo, no reescribirlo. Primer caso real: `src/modules/logistics/state/useDeliveriesStore.ts`. Detalle completo de la convención de las acciones del store en `DECISIONES_TECNICAS.md`.

### 4. Nota sobre el resto de la estructura "objetivo"
`logistics` sigue sin adoptar `views/`, `types/` ni `index.ts` dentro del módulo (su página sigue siendo `LogisticsPage.tsx` en la raíz del módulo, como el resto de los módulos reales — ver el relevamiento de `ESTRUCTURA_Y_ARQUITECTURA.md`). Solo se suman `services/` y `state/`, que son las dos carpetas que esta tarea necesitaba de verdad; no se fuerza el resto de la migración sin necesidad concreta.
