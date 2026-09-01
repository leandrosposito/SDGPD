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

## [28/08/2026] — Limpieza estructural del FrontEnd y alias de imports `@/` (warning-only)

### 1. Contexto
Se auditó el proyecto contra el filesystem real (`find`/`grep`, no contra lo que decían los docs existentes) y se encontraron dos problemas relacionados: `FrontEnd/ARCHITECTURE.md` describía una estructura (componentes en `src/components/`, tipos en `src/types/`, router en `src/router/`) que una migración anterior ya había dejado atrás moviendo todo a `src/shared/` sin actualizar el doc, con varias carpetas placeholder sin uso real de por medio. Los imports relativos profundos resultantes (`../../../shared/...`) eran además frágiles ante cualquier reorganización de carpetas — justo el tipo de cambio que esta misma limpieza estaba haciendo.

### 2. Decisiones adoptadas

| Decisión | Resultado | Justificación |
|---|---|---|
| Limpieza estructural: eliminar `FrontEnd/ARCHITECTURE.md`, `src/core/`, `src/infrastructure/`, `src/shared/utils/`, `src/shared/services/`, `src/modules/_template/`, `src/components/layout/PlaceholderPage` y las carpetas vacías resultantes; mover `src/hooks/useDashboard.ts` a `src/shared/hooks/` | Ejecutado | Placeholders `.gitkeep`-only y documentación redundante sin uso real (0 usos verificados por grep), o contenido ya migrado a `src/shared/` sin actualizar el doc. `src/services/mock/` se dejó donde está (4 archivos, 7 consumidores — moverlo era un cambio más grande que esta limpieza, no una decisión de placeholder). Se descartó dejar `ARCHITECTURE.md` como registro histórico: es exactamente el tipo de documento que ya demostró desactualizarse en silencio. **Vigente, no revertida.** |
| Alias de imports `@/` configurado como *warning-only*, sin migrar en la misma pasada los ~142 imports relativos profundos ya existentes (142 warnings nuevas en 70 archivos vía `no-restricted-imports`, severidad `warn` para no romper `npm run lint`) | Adoptado en su momento; **superado después** | Se priorizó dejar el alias disponible para código nuevo sin tocar imports ya escritos, migrando gradualmente por módulo a medida que se tocara cada archivo. Se descartó poner la regla en `error` (habría roto el lint sobre código que nadie había arreglado todavía) y setear `baseUrl` en `tsconfig.app.json` (deprecado en TS 6, innecesario con `moduleResolution: "bundler"`). **Esta decisión quedó superada por la entrada `[30/08/2026]` de este mismo archivo** ("Reconciliación con origin/lean: alias `@/` y descarte del sistema de ADRs"): ahí se migraron los ~142 imports de una sola vez en vez de gradualmente. Se deja este registro para que quede el razonamiento de ambos lados, no solo el que terminó vigente. |

### 3. Estándar de uso obligatorio en el código
- La limpieza estructural sigue vigente: no recrear `src/core/`, `src/infrastructure/`, `src/shared/utils/`, `src/shared/services/` ni `src/modules/_template/` sin una decisión nueva que lo justifique explícitamente.
- Para el estándar de imports vigente (migración completa, no warning-only gradual), ver la entrada `[30/08/2026]` de este mismo archivo.

## [28/08/2026] — Inconsistencias Encontradas Entre Módulos (Relevamiento)

### 1. Contexto
Registro de inconsistencias detectadas al relevar el código real de los 9 módulos de `src/modules/`, `src/shared/components/ui/` y `src/shared/types/`, previo a sumar features nuevas. Es un registro de lectura — **no se corrigió nada acá**, queda para decidir prioridad después.

### 2. Inconsistencias encontradas

1. **El tooling "obligatorio" de la sección 2 no se usa en ningún lado todavía.** 0 archivos en `src/` importan `zod`, `zustand`, `lucide-react` o `sonner` (verificado por búsqueda de imports en todo `src/`). Todos los formularios (`CreateOrderModal`, `CreateClientModal`, `ProductFormModal`, `SupplierFormModal`, etc.) usan `useState` plano sin validación declarativa; todo el estado es local por página, sin ningún store de `zustand` (`src/shared/state/` ni siquiera existe como carpeta); todos los íconos del proyecto son SVGs inline escritos a mano (`IconClose`, `IconSearch`, `IconRevenue`, etc.) en vez de `lucide-react`; no hay un solo `toast` de `sonner` en el código.

   > **Actualización 28/08/2026 (mismo día, después de este relevamiento):** ya no es cierto para `zustand`, `lucide-react` y `sonner` — `logistics` los adoptó de verdad (ver `[28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner...` más abajo). `zod` sigue con 0 usos: esa feature no tenía ningún formulario. Ver también `[28/08/2026] — Cumplimiento Obligatorio de Tooling y Nomenclatura de Estados` al final de este archivo.

2. **Patrón de lista de datos triplicado.** Para la misma necesidad (listar filas de datos) conviven: (a) el componente compartido `Table` (14 archivos: `cash`, `inventory`, `orders`, `settings`, `suppliers`), (b) tablas HTML locales que no reutilizan `Table` (`dashboard/RecentOrdersTable.tsx`, `analytics/TopDebtorsTable.tsx`, `clients/ClientDirectoryTable.tsx`, `clients/ClientAccountsTable.tsx`, `suppliers/OrderItemsTable.tsx`, la matriz de permisos de `settings/TabUsersRoles.tsx`), y (c) un tablero Kanban (`logistics/LogisticsCard.tsx`, ya documentado como excepción en `COMPONENTES_Y_LAYOUTS.md`). Ninguna de las tres pagina.

   > **Actualización 28/08/2026 (mismo día, después de este relevamiento):** el punto (c) ya no aplica — `logistics/LogisticsCard.tsx` se eliminó, `logistics` pasó a usar `Table` compartido + paginación real (ver `[28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner...`). Los puntos (a) y (b) siguen exactamente igual en el resto de los módulos.

3. **Tarjeta de KPI reimplementada 5 veces.** `shared/components/ui/StatCard.tsx` (acoplado al tipo `KpiMetric`, solo lo usa `dashboard`), `modules/analytics/components/KpiCard.tsx`, `modules/orders/components/OrderKpis.tsx`, `modules/logistics/components/LogisticsKPIs.tsx` y `modules/cash/components/CashKPIs.tsx` implementan cada uno su propio markup y CSS para mostrar "label + valor + variación", sin reutilizar ningún componente común.

4. **Navegación por tabs duplicada.** `shared/components/ui/Tabs.tsx` existe y lo usan `inventory` y `suppliers` (`SupplierDetailPanel`), pero `settings/SettingsPage.tsx` y `clients/ClientsPage.tsx` reimplementan su propia navegación de tabs (botones + estado local) sin usarlo.

5. **Convención de valores de "estado" inconsistente entre dominios.** La mayoría de los tipos usan uniones en inglés minúscula (`OrderStatus`, `DeliveryStatus`: `'pending'|'preparing'|...`), pero `ClientAccount.status` usa strings en español capitalizados (`'Al dia' | 'Con Deuda'`) y `SupplierPurchaseOrder.status`/`InvoiceRecord.status` usan otro set distinto (`'paid'|'pending'|...`/`'paid'|'pending'`). No hay un tipo de estado único ni una convención de nomenclatura común entre dominios.

   > **Actualización 28/08/2026 (mismo día, después de este relevamiento):** este hallazgo pasó de "detectado" a norma oficial obligatoria para tipos de estado nuevos — ver `[28/08/2026] — Cumplimiento Obligatorio de Tooling y Nomenclatura de Estados` al final de este archivo. Los tres tipos ya existentes que no cumplen quedan como deuda técnica registrada ahí mismo; no se tocaron.

6. **`src/shared/types/` no contiene tipos genéricos, solo tipos por dominio.** Los 9 archivos (`analytics.types.ts`, `cash.types.ts`, etc.) son 100% específicos de un módulo — no existe ningún tipo verdaderamente reutilizable entre módulos (p. ej. `ID`, `Paginated<T>`, `Money`, `Address`), pese a que la carpeta está documentada en `ESTRUCTURA_Y_ARQUITECTURA.md` como el lugar para "tipos e interfaces compartidos".

7. **La forma de los datos mock no sigue un estándar único entre módulos.** `orders`, `clients`, `suppliers` y `logistics` exportan un array plano en la raíz del archivo; `dashboard` e `inventory` exportan un objeto único con varios arrays anidados por categoría; `analytics` exporta un objeto indexado por período (`TimePeriod`); `settings` exporta varias constantes sueltas en vez de un objeto único. Ninguna de estas formas está documentada como la esperada.

### 3. Norma de este registro
Estos hallazgos no implican una corrección automática. Cualquier decisión de unificación (elegir una única implementación de tabla, un único componente de KPI, adoptar `zod`/`zustand` realmente, etc.) debe registrarse como una entrada nueva y fechada en este archivo o en `COMPONENTES_Y_LAYOUTS.md`, igual que las decisiones anteriores.

## [28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner; Reemplazo del Kanban de Logística

### 1. Contexto
`logistics` reemplaza su tablero Kanban por una tabla paginada de "Entregas del Día" (pendiente / en ruta / completada). Es la primera feature del proyecto que usa de verdad 3 de las 4 herramientas "obligatorias" declaradas en `[25/08/2026] — Utilidades Esenciales del Frontend` — hasta ahora ninguna se usaba en ningún archivo (ver `[28/08/2026] — Inconsistencias Encontradas Entre Módulos`, punto 1). Esta entrada fija la convención para las próximas veces que se use cada una.

### 2. Reemplazo del Kanban por tabla — decisión y motivo
El tablero Kanban de `LogisticsCard` (3 columnas) se eliminó por completo (no quedó como vista alternativa) porque no escala a un volumen alto de entregas: no es paginable por columna y obliga a renderizar todas las tarjetas de cada estado en el DOM. Se reemplazó por la tabla paginada + filtro por estado que ya estaba definida como patrón oficial en `COMPONENTES_Y_LAYOUTS.md` (`[28/08/2026] — Patrón Estándar para Listas de Datos`), y esta es su primera implementación real — ver el detalle técnico completo en `[28/08/2026] — Primera Tabla Paginada Real` de ese mismo archivo. La excepción que este mismo `DECISIONES_TECNICAS.md`/`COMPONENTES_Y_LAYOUTS.md` le tenía documentada al Kanban queda revertida, no vigente.

### 3. `zustand` — primer store real, convención de referencia
`src/modules/logistics/state/useDeliveriesStore.ts` es el primer store de `zustand` del proyecto. Convención fijada para los que vengan después:
- **Ubicación**: `modules/<modulo>/state/use<Nombre>Store.ts` mientras el estado sea específico de un módulo (no `shared/` todavía, según se indicó para esta tarea). Si en el futuro un store necesita compartirse entre módulos, se promueve a `shared/state/use<Nombre>Store.ts` — mismo nombre de carpeta (`state/`) en ambos casos, para que promoverlo sea mover el archivo, no reescribirlo.
- **Nombres genéricos, no acoplados al módulo**: el store se llama `useDeliveriesStore` (no `useLogisticsStore`) y su acción se llama `advanceDeliveryStatus` (no `advanceLogisticsStatus`), porque "entrega" y "estado de entrega" son un concepto de negocio que no es exclusivo de logística. El tipo `DeliveryStatus` ya vivía en `shared/types/logistics.types.ts` con este mismo criterio desde antes.
- **Las acciones devuelven un resultado estructurado, no texto de UI**: `advanceDeliveryStatus` devuelve `{ success, deliveryId, previousStatus?, newStatus?, reason? }` en vez de lanzar una excepción o incluir un mensaje en español. Quien llama (`LogisticsPage`) decide cómo mostrarlo — en este caso, con un toast de `sonner`. Esto mantiene el store libre de texto de presentación, para que sea igual de válido si mañana se promueve a `shared/` y lo consume una pantalla distinta con otro copy.
- **Transiciones de estado unidireccionales**: la única acción que cambia el estado es `advanceDeliveryStatus`, que avanza un solo paso según un mapa fijo (`pending → in_transit → delivered`). No existe ningún setter genérico de estado expuesto al UI, así que retroceder un estado no es posible por diseño de la API del store, no por una validación que se pueda saltear.

### 4. `lucide-react` — primer uso real
`Pagination.tsx` (`ChevronLeft`, `ChevronRight`) y `DeliveriesTable.tsx` (`Clock`, `MapPin`, `Truck`, `CheckCircle2`) importan íconos de `lucide-react` en vez de SVGs inline a mano, como venía siendo la práctica real en todo el resto del proyecto pese a la decisión de `[25/08/2026]`.

### 5. `sonner` — primer uso real
Se montó `<Toaster richColors position="top-right" />` en `src/App.tsx` (no existía en ningún lado — sin esto, `toast()` no renderiza nada visible). `LogisticsPage` dispara `toast.success(...)` al avanzar una entrega de estado y `toast.error(...)` si la transición no es válida (entrega ya completada) o no se encuentra la entrega. No se usó `alert()` en ningún punto nuevo.

### 6. `zod` — sigue sin primer uso real
Esta feature no agrega ningún formulario (el cambio de estado es un botón por fila, no un form), así que no había nada que validar con `zod` acá. No se forzó un uso artificial solo para marcar la casilla. Sigue pendiente el primer uso real de `zod` + `react-hook-form` el día que se implemente el primer formulario nuevo del proyecto (o se migre uno existente).

### 7. `orderId` como referencia real (no por convención de nombre)
`shared/types/logistics.types.ts` tipa `Delivery.orderId` como `Order['id']` (importando el tipo `Order` desde `shared/types/order.types.ts`), no como un `string` suelto. Es el primer campo del proyecto que declara explícitamente una relación entre dominios a nivel de tipo, en vez de solo coincidir por nombre de campo (el problema que documenta el punto 5 de `[28/08/2026] — Inconsistencias Encontradas Entre Módulos`, sobre convenciones de estado, aplica de forma similar a estas relaciones informales). Sigue sin haber una importación en tiempo de ejecución entre `modules/logistics` y `modules/orders`: el mock de `logistics.data.ts` tiene los IDs de pedidos reales copiados a mano desde `orders.data.ts` (`ord-001`..`ord-006`, reutilizados varias veces porque ese mock solo tiene 6 pedidos), no importados. Este patrón (tipar la referencia con `Order['id']`, sin importar `modules/orders`) queda como el de referencia para la próxima relación cross-módulo que necesite ser real y no por convención de nombre.

> **Nota 28/08/2026 (cierre posterior):** esta implementación se hizo sin pasar antes por el paso de "proponer 2-3 opciones y esperar decisión" que exige la regla de relación entre módulos. Quedó señalado como punto abierto y se cerró formalmente confirmando esta misma opción — ver `[28/08/2026] — Cierre: Relación logistics↔orders (Opción A confirmada)` al final de este archivo, con las opciones descartadas y el trigger de revisión.

### 8. Renombre de `LogisticsOrder` a `Delivery`
El tipo `LogisticsOrder` (en `shared/types/logistics.types.ts`) se renombró a `Delivery`. Motivo: el nombre anterior mezclaba dos conceptos de dominio distintos ("pedido", que vive en `orders`, y "entrega", que es lo que de verdad modela este tipo) — exactamente la ambigüedad que el punto anterior busca evitar con `orderId: Order['id']`. Se verificó que el tipo y `DeliveryStatus` solo se usaban dentro de `modules/logistics/` y `data/mock/logistics.data.ts` antes de renombrar, así que no rompe nada fuera de ese alcance.

## [28/08/2026] — Cumplimiento Obligatorio de Tooling y Nomenclatura de Estados

### 1. Contexto
Limpieza de documentación previa a seguir sumando features: esta entrada convierte dos hallazgos de relevamiento (`[28/08/2026] — Inconsistencias Encontradas Entre Módulos`, puntos 1 y 5) en normas oficiales obligatorias hacia adelante, y deja registrada la deuda técnica existente sin corregirla.

### 2. Norma: nomenclatura de tipos de "estado"
Todo tipo de "estado" (`*Status`) que se cree de acá en adelante en el proyecto debe ser una unión de strings en inglés, minúscula, siguiendo el patrón ya mayoritario de `OrderStatus`/`DeliveryStatus` (`'pending' | 'preparing' | 'dispatched' | ...`). Queda prohibido:
- Reproducir la variante en español/capitalizado que usa `ClientAccount.status` (`'Al dia' | 'Con Deuda'`).
- Inventar cualquier otro formato nuevo (otro idioma, otra convención de casing, etc.) para un campo de estado.

**Deuda técnica conocida — no se toca en esta tarea:** los siguientes tipos de estado ya existentes no siguen esta norma y quedan señalados para corregir más adelante, cuando corresponda:
- `ClientAccount.status` (`shared/types/client.types.ts`) — viola la norma en idioma y casing (`'Al dia' | 'Con Deuda'`).
- `SupplierPurchaseOrder.status` (`shared/types/supplier.types.ts`) — ya está en inglés minúscula, pero define un vocabulario de estados propio y desconectado (`'paid' | 'pending' | 'overdue'`) en vez de alinearse a los ya existentes.
- `InvoiceRecord.status` (`shared/types/settings.types.ts`) — mismo caso que el anterior (`'paid' | 'pending'`).

### 3. Norma: cumplimiento obligatorio de zod / zustand / lucide-react / sonner
`[25/08/2026] — Utilidades Esenciales del Frontend` ya declaraba estas 4 herramientas como obligatorias, pero durante meses de código real ninguna se usó (ver `[28/08/2026] — Inconsistencias Encontradas Entre Módulos`, punto 1). `logistics` rompió esa inercia para 3 de las 4 (`zustand`, `lucide-react`, `sonner` — ver `[28/08/2026] — Primer Uso Real de...` más arriba), pero `zod` todavía no tiene ningún caso real porque esa feature no incluyó un formulario.

Queda fijado como norma, sin excepción, a partir de ahora:
- **Todo formulario nuevo** que se programe de acá en adelante debe validar con `zod` + `react-hook-form` (`@hookform/resolvers/zod`), sin importar que el resto de los formularios legacy del proyecto (`CreateOrderModal`, `CreateClientModal`, `ProductFormModal`, `SupplierFormModal`, etc.) todavía no lo hagan.
- **Todo ícono nuevo** debe salir de `lucide-react`, nunca un SVG inline a mano — aunque el proyecto siga lleno de SVGs inline preexistentes.
- **Toda notificación nueva** de éxito/error/advertencia debe usar `sonner` (`toast.success`/`toast.error`/etc.), nunca `alert()` ni una implementación ad-hoc.
- **Todo estado compartido nuevo** que amerite un store (no estado local de un solo componente) debe usar `zustand`, siguiendo la convención de ubicación y contrato de acciones fijada en `[28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner...`, punto 3.

Que el código legacy no cumpla no es excusa ni precedente para que código nuevo tampoco cumpla — es exactamente la deuda que estas normas buscan dejar de acumular.

### 4. Norma de este registro
Cuando se corrija alguno de los ítems de deuda técnica listados en el punto 2, o se implemente el primer formulario real con `zod`, se registra como una entrada nueva y fechada acá — no se edita esta entrada para dar la corrección por hecha antes de tiempo.

## [28/08/2026] — Cierre: Relación logistics↔orders (Opción A confirmada)

### 1. Contexto
La feature "Entregas del Día" (`[28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner...`, punto 7) implementó `Delivery.orderId: Order['id']` sin pasar antes por el paso de "proponer 2-3 opciones y esperar decisión" que exige la regla de relación entre módulos. Se presentaron después, retroactivamente, 3 opciones con pros/contras. Esta entrada cierra esa decisión: **no hay cambios de código en esta tarea**, solo se confirma por escrito lo ya implementado.

### 2. Decisión confirmada — Opción A
La relación `logistics → orders` se resuelve con `Delivery.orderId` tipado como `Order['id']` (`shared/types/logistics.types.ts` importa únicamente el *tipo* `Order` desde `shared/types/order.types.ts`). No existe ningún import en tiempo de ejecución entre `modules/logistics` y `modules/orders` — ni de componentes ni de lógica. El mock de `logistics.data.ts` tiene los IDs de pedidos reales copiados a mano desde `orders.data.ts`, no importados en runtime.

### 3. Opciones descartadas y motivo

| Opción | Descripción | Motivo de descarte |
|---|---|---|
| **B** | Servicio/repositorio compartido en `shared/services/` que resuelve datos de un pedido por ID, consumido por ambos módulos | Resuelve un problema que hoy no existe (mostrar datos reales del pedido en la tabla de logística): agrega superficie nueva — hay que definir el contrato de ese repositorio compartido — sin necesidad concreta todavía; `shared/services/` sigue sin ningún archivo real. Queda como la opción a adoptar si ese problema aparece de verdad (ver punto 4). |
| **C** | Evento/mensaje desacoplado (domain event) en vez de referencia directa | Sobre-ingeniería para el tamaño y la arquitectura actual del proyecto: no hay backend, no hay bus de eventos, es un único frontend monolítico. Diseñar para ese escenario ahora viola la norma general de no construir para requisitos hipotéticos futuros. |

### 4. Trigger de revisión explícito
Si en el futuro se necesita mostrar **datos reales del pedido** (número de pedido, cliente real, etc.) en la tabla de entregas de `logistics`, en vez de seguir agregando campos duplicados al mock de `Delivery`, **reevaluar hacia la Opción B** (servicio/repositorio compartido en `shared/services/`). Ese es el momento de implementarla, no antes.

### 5. Verificación de comentarios pendientes en código
Se revisó `src/modules/logistics/` y `shared/types/logistics.types.ts` buscando `TODO`/`FIXME`/notas de "pendiente de decisión" relacionadas a esta relación. No se encontró ninguno — la implementación de `orderId` no tenía ningún comentario marcando esto como abierto, el punto solo estaba señalado en el resumen de la tarea anterior y en este documento. No hubo nada que limpiar.

## [28/08/2026] — Productos Bajo Stock Mínimo (inventory)

### 1. Contexto
Feature nueva: listado de productos con stock por debajo del mínimo, con acción de "solicitar reposición" por producto. Antes de escribir código se investigó el estado real de `src/modules/inventory/` y de `shared/types/inventory.types.ts` — no se asumió nada.

### 2. Campo de stock mínimo: ya existía, se reutilizó
`InventoryItem.minStock` y `InventoryItem.stock` ya existían en `shared/types/inventory.types.ts` (y en `data/mock/inventory.data.ts`) desde antes de esta tarea — probablemente del pase de estructuración inicial del proyecto. **No se agregó ningún campo nuevo ni se creó una entidad de producto paralela.** El mock de `items[]` se extendió de 2 a 18 productos para tener variedad real: 11 por debajo del mínimo, 2 exactamente en el límite (`stock === minStock`, deben quedar afuera del listado — caso borde probado a propósito) y 5 por encima.

### 3. Decisión estructural: tab nueva, no se tocó la tab "Reposición" existente
`InventoryPage.tsx` ya tenía 8 tabs, y una de ellas — `purchases` / "Reposicion" (`TabPurchases.tsx`) — ya mostraba "productos con stock por debajo de su mínimo", pero modela un concepto **distinto y más específico**: `PurchaseSuggestion`, con `supplierName` (string libre, no ID tipado — el mismo anti-patrón que este documento ya viene señalando como deuda), `suggestedQuantity` y `estimatedCost` — básicamente un borrador de orden de compra a un proveedor concreto, con botón "Generar OC".

Lo que pide esta tarea es más simple y genérico: marcar un producto como "reposición solicitada" sin comprometer proveedor ni cantidad. Conflicionar ambos conceptos en la misma tab, o reescribir `TabPurchases`/`PurchaseSuggestion`, hubiera sido tocar una feature existente sin que se haya pedido. Se decidió agregar una **tab nueva** — `low-stock` / "Bajo Stock Mínimo", ubicada justo después de "Stock Actual" — que reutiliza `InventoryItem` tal cual y no toca `TabPurchases.tsx` ni `PurchaseSuggestion` en absoluto.

### 4. `ReplenishmentStatus` — modelado genérico
`shared/types/inventory.types.ts` agrega:
```ts
export type ReplenishmentStatus = 'not_requested' | 'requested';
```
Nombre genérico (no `InventoryReplenishmentStatus`), mismo criterio que `DeliveryStatus` en `logistics.types.ts`. El estado de reposición **no se guarda en `InventoryItem`** ni se mezcla con `PurchaseSuggestion`: vive aparte, en el store de `zustand` (`Record<string, ReplenishmentStatus>` indexado por `productId`), para que el día que se conecte con `suppliers` de verdad alcance con sumarle un campo (ej. `supplierId`) al registro de reposición, sin tocar `InventoryItem` ni el tipo de estado.

### 5. `useReplenishmentStore` — segundo store real del proyecto, mismo contrato que `useDeliveriesStore`
`modules/inventory/state/useReplenishmentStore.ts` sigue al pie de la letra la convención fijada en `[28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner...`, punto 3:
- Ubicación `modules/<modulo>/state/use<Nombre>Store.ts`.
- La acción `requestReplenishment(productId)` devuelve un resultado estructurado (`{ success, productId, status, reason? }`), no un mensaje de UI — `TabLowStock.tsx` decide el texto del toast de `sonner`.
- Transición unidireccional: la única acción posible es pasar de `'not_requested'` a `'requested'`; un segundo intento sobre el mismo producto devuelve `success: false, reason: 'already-requested'` en vez de sobrescribir en silencio. La UI además retira el botón de acción una vez solicitado, igual que en logística con las entregas ya completadas.

### 6. Relación futura con `suppliers` — opciones propuestas, sin implementar

| Opción | Descripción | Pros / Contras |
|---|---|---|
| **A (recomendada)** | `supplierId: Supplier['id']` tipado en el registro de reposición, importando solo el *tipo* `Supplier` desde `shared/types/supplier.types.ts` — mismo patrón ya adoptado y documentado para `logistics↔orders` | Pro: mínimo acoplamiento, consistente con el precedente ya establecido en el proyecto. Contra: para elegir un proveedor real en la UI hoy no hay una forma compartida de leer datos de `suppliers` sin importar el módulo o duplicar su mock. |
| **B** | Servicio/repositorio compartido en `shared/services/` que resuelve datos de proveedor por ID, consumido por ambos módulos | Pro: mismo mecanismo ya evaluado (y pospuesto) para `logistics↔orders` — consistencia entre módulos. Contra: mismo costo ya señalado ahí: `shared/services/` sigue sin ningún archivo real, no hay necesidad concreta todavía. |
| **C — descartada** | Reusar `InventoryItem.supplier` (ya existe, string libre con el nombre del proveedor) como si fuera la referencia | Es exactamente el anti-patrón que `PurchaseSuggestion.supplierName` ya reproduce y que este documento señala como deuda (coincidencia informal de nombre, no ID tipado). No cumple la regla base de relación entre módulos — descartada. |

**Trigger de revisión** (mismo criterio que en `logistics↔orders`): implementar la Opción A recién cuando la UI necesite de verdad elegir/mostrar un proveedor real para una reposición — no antes.

### 7. Hallazgo colateral (no corregido, fuera de alcance)
Al revisar `TabStockCurrent.tsx`/`TabPurchases.tsx` para esta tarea se encontró que usan clases CSS que no están definidas en ningún lado (`text-danger`, `.btn-action`, `.btn-action--ghost`) — no aplican ningún color/estilo real. `text-warning` y `font-mono` sí están definidos, pero de forma local en `InventoryPage.css`, no como tokens centrales. `TabLowStock.css` (esta tarea) no reutiliza ninguna de esas clases — define las suyas propias con variables de `src/styles/variables.css`. No se tocó `TabStockCurrent.css`/`TabPurchases.tsx` — no era parte de esta tarea.

## [30/08/2026] — Reconciliación con origin/lean: alias `@/` y descarte del sistema de ADRs

### 1. Contexto
Esta rama local (`lean`, sobre `4d1e8a2`) quedó 9 commits atrás de `origin/lean` mientras acumulaba el trabajo de paginación/zustand/low-stock documentado arriba, todo sin commitear. Antes de perder ese trabajo, se resguardó en la rama `respaldo-pre-reconciliacion-30-08-2026`, y esta entrada documenta las dos decisiones de fondo tomadas al traer esos 9 commits de vuelta.

### 2. Decisiones adoptadas

| Propuesta | Resultado | Justificación |
|---|---|---|
| Alias de imports `@/` (mapeado a `src/`) | Adoptado para todo el proyecto | Ya venía configurado en `vite.config.ts`/`tsconfig.app.json` en `origin/lean`. Se migraron a `@/...` todos los imports relativos de 2+ niveles (`../../...`) del proyecto, incluyendo los del trabajo local (paginación, stores de zustand, `TabLowStock`, módulo `logistics` nuevo). Reforzado por la regla ESLint `no-restricted-imports` (warning sobre `../../**`), también traída de `origin/lean`. |
| Sistema de ADRs (`Documentacion/decisiones/`, `docs/implementacion/`) | Evaluado y descartado | `origin/lean` los había agregado (commits `dae1937` y parte de `df70812`). Se decidió no adoptarlos: habrían duplicado el registro de decisiones que ya cubren este mismo archivo y los `docs/*.md` de arquitectura de módulo (`ESTRUCTURA_Y_ARQUITECTURA.md`, `COMPONENTES_Y_LAYOUTS.md`, `RUTAS_Y_MODULOS.md`) — ver el historial completo de este documento como prueba de que ese sistema único ya viene funcionando bien. No fue un olvido: se evaluó el contenido real que traían esos commits y se eliminó deliberadamente por esta razón, en ambas copias del proyecto en las que se probó.

### 3. Otros ajustes de la reconciliación (sin decisión nueva, solo registro)
- El shape nuevo de `InventoryItem` que trae `origin/lean` (`barcode`, `unitOfMeasure`, `status`, `description?`) se aceptó tal cual; los 16 productos de bajo stock del mock local (que fueron escritos contra el shape viejo) se completaron con valores realistas por producto para cumplir el shape nuevo.
- La tab "Bajo Stock Mínimo" (`TabLowStock`, ver entrada `[28/08/2026] — Productos Bajo Stock Mínimo` arriba) se reconectó para leer del mismo estado async (`products`, vía `fetchProducts()`) que ya usa la tab "Stock Actual" de `origin/lean`, en vez del mock estático.
- El fix de tipos de zod v4 + `@hookform/resolvers` en `ProductFormModal` (necesario porque `origin/lean` usa `z.coerce.number()`) ya existía de forma independiente en el trabajo local, con el mismo patrón exacto (3 generics de `useForm`). Se unificó a una sola versión, sin código duplicado.

### 4. Estándar de uso obligatorio en el código
- **Imports:** usar `@/shared/...`, `@/modules/...`, etc. en vez de rutas relativas que suban más de un nivel (`../../...`). Un import al mismo nivel o un nivel arriba (`./Foo`, `../Foo`) sigue siendo válido y no necesita el alias.
- **Decisiones técnicas:** todo registro de decisión de arquitectura/estructura de proyecto va en este archivo (`docs/DECISIONES_TECNICAS.md`); no crear un sistema de ADR paralelo ni una carpeta `decisiones/` nueva.

## [01/09/2026] — Contexto de sesión y sucursal activa (infraestructura, sin features nuevas)

### 1. Contexto
SDGPD se comercializa como SaaS: cada empresa cliente es un inquilino aislado, un usuario pertenece a una sola empresa pero esa empresa puede tener varias sucursales, y el usuario opera cambiando la sucursal activa. Esta tarea construye esa infraestructura (tipos, mock/servicio, store de sesión, mecanismo de reset entre stores, selector en el layout) e integra el filtrado por sucursal en un único módulo (`logistics`), a modo de caso verificable de punta a punta. No agrega ninguna pantalla de negocio nueva.

### 2. D1 — La empresa no se modela en el frontend como filtro
`Company` existe como dato descriptivo de la sesión (`SessionUser.company: { id, name }`, mostrado en `BranchSelector`), pero ningún tipo de dominio (`Delivery`, `InventoryItem`, `ClientAccount`, etc.) recibe un `tenantId`/`empresaId`. El aislamiento entre empresas es responsabilidad exclusiva del backend vía sesión/token — el front nunca ve datos de otra empresa porque el servidor nunca se los manda. Si la empresa fuera un parámetro que la UI pudiera manipular (aunque sea de solo lectura hoy), sería una superficie de fallo de seguridad el día que exista backend real: cualquier función que hoy reciba `empresaId` desde el front sería un candidato a IDOR si el backend confiara en ese valor en vez de derivarlo de la sesión autenticada.

### 3. D2 — La sucursal sí es estado de UI de primera clase
A diferencia de la empresa, la sucursal cambia durante la sesión por elección explícita del usuario — es exactamente el tipo de estado que ya vive en un store de `zustand` en este proyecto (ver `useDeliveriesStore`/`useReplenishmentStore`). `activeBranchId` vive en `useSessionStore`, no en cada módulo.

### 4. D3 — Tipos nuevos en `shared/types/session.types.ts`
`Branch.status: 'active' | 'inactive'` sigue la norma de nomenclatura de tipos de estado fijada en `[28/08/2026] — Cumplimiento Obligatorio de Tooling y Nomenclatura de Estados` (unión de strings en inglés, minúscula) — mismo patrón que `InventoryItem.status`. `Branch`/`Company`/`SessionUser` se agregan al único directorio de tipos compartidos (`shared/types/`), junto a los 9 archivos de dominio ya existentes.

**Revisión posterior — cuarta sucursal `inactive` en el mock:** las 3 sucursales originales del mock (`session.mock.ts`) eran todas `active`, así que el camino de rechazo de `setActiveBranch` (sucursal inactiva) nunca se ejercitaba. Se agregó `branch-004` ("Sucursal Villa Maria (cerrada)", `status: 'inactive'`) **sin** asignarle ninguna entrega en `logistics.data.ts` a propósito: una sucursal inactiva no debería ser alcanzable, y si tuviera datos hubiera podido ocultar un rechazo que en realidad no funciona. Verificado en el navegador y desde la consola (ver sección de verificación funcional): aparece deshabilitada en el dropdown (no se puede elegir con mouse ni con teclado), y `useSessionStore.getState().setActiveBranch('branch-004')` devuelve `{success: false, branchId: 'branch-004', reason: 'inactive'}` sin lanzar excepción y sin modificar `activeBranchId`; `setActiveBranch('branch-inexistente')` devuelve `{success: false, reason: 'not-found'}` en las mismas condiciones. El código ya se comportaba como documentaba la tarea anterior — no hizo falta corregir `useSessionStore`, solo agregar el dato de mock que probaba la rama.

### 5. D4 — `branchId` viaja como parámetro explícito a los servicios
`deliveries.service.ts#getDeliveriesForDate(deliveries, date, branchId)` recibe la sucursal como tercer parámetro; no lee `useSessionStore` internamente. Motivo: mantener la capa de servicios sin estado global oculto — la firma de la función deja explícita toda su dependencia, en vez de esconder un acoplamiento a un store de React dentro de una función que en el futuro será una llamada HTTP. `LogisticsPage` lee `activeBranchId` de `useSessionStore` y lo pasa como argumento; el servicio no importa el store.

**Nota de seguridad para cuando exista backend real:** que el frontend mande `branchId` en la request es una conveniencia de UI (permite construir la URL/payload sin que el backend tenga que inferir la sucursal), **no una autorización**. El backend deberá validar siempre que la sucursal recibida pertenezca efectivamente a la empresa de la sesión autenticada antes de responder — nunca confiar en que el front solo puede pedir sucursales propias porque hoy la UI solo se las ofrece a elegir. Esto es la misma clase de riesgo que D1 señala para `tenantId`, aplicada a `branchId`.

### 6. D5 y 4.4 — Mecanismo de reset entre stores al cambiar de sucursal
Cada store con datos de negocio (`useDeliveriesStore`, `useReplenishmentStore`) suma una acción `reset()` que lo devuelve a su estado inicial (`deliveries: structuredClone(LOGISTICS_MOCK_DATA)` / `statusByProductId: {}`). `useSessionStore.setActiveBranch` invoca esos resets a través de un registro central, `shared/state/resettableStores.ts` (`registerResettableStore`/`resetAllStores`), en vez de importar cada store de módulo directamente.

**Revisión posterior (`structuredClone` en `useDeliveriesStore`):** el estado inicial y `reset()` ponían en el store la misma referencia del array del mock (`deliveries: LOGISTICS_MOCK_DATA`), no una copia. Se investigó `advanceDeliveryStatus` antes de decidir el fix: **es inmutable** (`state.deliveries.map((d) => d.id === deliveryId ? { ...d, status: nextStatus } : d)`, siempre devuelve un array nuevo), así que hoy no corrompe el mock en la práctica. Se aplicó `structuredClone(LOGISTICS_MOCK_DATA)` de todas formas, tanto en el estado inicial como en `reset()`, como salvaguarda ante un cambio futuro que sí mute un registro in-place — mismo patrón que ya usa `services/mock/*.ts` (`delay` + `structuredClone`). Se revisó `useReplenishmentStore` por el mismo riesgo: su estado inicial es `{}` literal (no una referencia a datos de mock compartidos) y `reset()` asigna otro `{}` literal nuevo — no aplica el mismo problema, no se tocó.

**Por qué un registro y no un import directo:** `useSessionStore` importando `useDeliveriesStore`/`useReplenishmentStore` invertiría la dirección de dependencia del proyecto (`modules/` depende de `shared/`, nunca al revés — ver `RUTAS_Y_MODULOS.md`). Con el registro, cada store de módulo se auto-registra con una sola línea (`registerResettableStore(() => useXStore.getState().reset())`) inmediatamente después de su propio `create(...)` — `shared/state/useSessionStore.ts` nunca importa `modules/logistics/state/` ni `modules/inventory/state/`.

**Por qué es evidente dónde registrar un store nuevo:** la convención está escrita como comentario en el propio `resettableStores.ts`, y el patrón a copiar es literal y visible en los dos casos ya existentes (`useDeliveriesStore.ts`, `useReplenishmentStore.ts`): una línea `registerResettableStore(...)` justo debajo del `export const use<Nombre>Store = create(...)`. Un desarrollador que copie la estructura de un store existente para uno nuevo copia también esa línea sin tener que ir a buscar dónde se centraliza el reset.

Verificado manualmente (ver sección de verificación funcional): se solicitó reposición de un producto en `inventory` bajo "Sucursal Centro", se cambió a "Sucursal Sur", y el estado volvió a "Sin solicitar" — confirma que el reset cruza el límite de módulo correctamente sin que `inventory` y `logistics` se importen entre sí.
