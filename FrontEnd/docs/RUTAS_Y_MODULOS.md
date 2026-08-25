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
