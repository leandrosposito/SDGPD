# Registro de Decisiones Técnicas — SDGPD Frontend

## [25/08/2026] — Utilidades Esenciales del Frontend

### 1. Contexto
Se incorporan herramientas transversales clave (validación, estado global, iconografía y notificaciones) para establecer una base robusta previa al desarrollo de los módulos funcionales del ERP, asegurando coherencia técnica y evitando la duplicación de dependencias.

### 2. Decisiones adoptadas

| Categoría | Herramienta elegida | Alternativas descartadas | Justificación |
|---|---|---|---|
| Validación de datos | zod | yup, joi | Tipado estático integrado con TypeScript, ya en uso junto a react-hook-form. *(Nota: Identificado como preexistente durante la auditoría de dependencias, se respetó la decisión original).* |
| Estado compartido | zustand | Redux, Context API puro | Bajo boilerplate, buen rendimiento en actualizaciones frecuentes, curva de aprendizaje baja para el equipo. |
| Iconografía | lucide-react | react-icons, Font Awesome | Librería liviana, tree-shakeable, consistente visualmente con Tailwind. |
| Notificaciones | sonner | react-hot-toast, react-toastify | API simple, bajo peso, buena integración con React 18+. |

### 3. Estándar de uso obligatorio en el código
- **Validación:** todo formulario debe definir su esquema en un archivo *.schema.ts dentro del módulo correspondiente, usando zod, y conectarse a eact-hook-form mediante @hookform/resolvers/zod.
- **Estado compartido:** cada store de zustand debe vivir en src/shared/state/ o dentro del módulo correspondiente si es estado específico de dominio; nombrar los archivos use<Nombre>Store.ts.
- **Iconografía:** importar íconos únicamente desde lucide-react; no mezclar con otras librerías de íconos ni con SVGs sueltos para casos ya cubiertos por esta librería.
- **Notificaciones:** todo feedback de acciones (éxito, error, advertencia) debe canalizarse a través de sonner; no usar lert() nativo ni implementaciones de notificación ad-hoc.

### 4. Norma de no duplicación
Ninguna herramienta nueva puede agregarse a futuro para resolver un problema ya cubierto por las herramientas de esta tabla, sin que quede documentada la razón específica por la cual la solución existente no es suficiente, y sin registrar esa excepción en este mismo archivo.
