## [25/08/2026] — Organización de Carpetas y Separación de Responsabilidades

### 1. Principio general
Todo el código fuente de la aplicación vive exclusivamente dentro de "src/". La raíz del proyecto contiene únicamente archivos de configuración ("package.json", "tsconfig.json", configuración de framework, linters y estilos globales de build). Ningún componente de negocio o vista se ubica fuera de "src/".

### 2. Mapa de carpetas

| Carpeta | Propósito |
|---|---|
| "src/app" (o "pages") | Rutas de la aplicación (según framework) |
| "src/core/entities" | Entidades de dominio |
| "src/core/use-cases" | Casos de uso / lógica de aplicación |
| "src/core/repositories" | Contratos de acceso a datos |
| "src/core/value-objects" | Objetos de valor inmutables |
| "src/modules" | Módulos de negocio (uno por dominio funcional del ERP) |
| "src/infrastructure/api" | Clientes de API concretos |
| "src/infrastructure/config" | Configuración de infraestructura |
| "src/shared/components" | Componentes de UI reutilizables (ubicación respetada de lo ya existente del usuario) |
| "src/shared/hooks" | Hooks reutilizables |
| "src/shared/utils" | Utilidades transversales |
| "src/shared/types" | Tipos e interfaces compartidos (ubicación única, no duplicada) |
| "src/shared/state" | Stores de estado global (zustand) |
| "src/assets/icons", "src/assets/images" | Recursos estáticos globales |
| "src/styles" | Estilos globales adicionales a los ya definidos por el usuario |

### 3. Reubicaciones realizadas en esta etapa
- **Origen:** "src/types/*" → **Destino:** "src/shared/types/"
  - **Motivo:** Consolidar todos los tipos bajo el dominio de "shared", resolviendo la existencia previa simultánea de "src/types" y "src/shared/types", en estricto cumplimiento de la norma de ubicación única para código compartido. Se actualizaron exitosamente las rutas relativas de import en los 50 archivos referenciantes.

### 4. Norma de ubicación única
Ninguna categoría de archivo (tipos, assets, estilos globales, lógica de dominio) puede tener más de una ubicación válida en el proyecto. Si en el futuro parece necesaria una carpeta nueva para algo que ya tiene ubicación definida en esta tabla, se debe reutilizar la existente, no crear una alternativa.
