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

### 7. D6 — Alcance de filtrado en esta tarea: solo `logistics`
`Delivery` suma `branchId: Branch['id']` (import de solo tipo, mismo patrón ya establecido para `orderId: Order['id']` — ver `[28/08/2026] — Primer Uso Real de zustand...`, punto 7). Los 18 registros de `logistics.data.ts` se repartieron entre las 3 sucursales de forma despareja a propósito (branch-001: 8, branch-002: 6, branch-003: 4 sobre el total; 7/4/3 sobre el subconjunto "hoy" que la pantalla realmente muestra) para que el cambio de sucursal sea verificable a simple vista en el conteo de filas. No se tocó `InventoryItem` (sin `minStock`/stock por sucursal) ni ningún otro dominio — exactamente lo que D6 pedía no tocar.

### 8. D7 — Persistencia de la sucursal activa
`localStorage`, clave `sdgpd.activeBranchId` (namespaceada, mismo criterio que la clave `app-theme` ya existente en `Header.tsx`). Al hidratar (`useSessionStore.loadSession`), se valida que la sucursal guardada exista entre las del usuario **y** siga `active`; si no, se cae a `defaultBranchId` sin lanzar error ni romper el layout. Casos borde probados a propósito: (a) `branchId` inexistente en `localStorage` → cae a la sucursal por defecto ("Sucursal Centro") mostrando sus 7 entregas; (b) `branchId` de una sucursal que existe pero está `inactive` (`branch-004`, agregada en la revisión posterior — ver punto 4) → mismo resultado, cae a la sucursal por defecto en vez de quedar "atascado" en una sucursal no elegible. Ninguno de los dos casos rompió el layout ni entró en loop de error.

### 9. Limitaciones conocidas, no corregidas en esta tarea
- Mientras `useSessionStore` carga por primera vez, `LogisticsPage` muestra un `SkeletonTable` en la tabla (activeBranchId es `null` hasta que la sesión resuelve), pero `LogisticsKPIs` y `DeliveryFilters` de esa misma pantalla reciben un array vacío en ese instante y pueden mostrar "0" brevemente antes de que la sesión cargue (delay mock de 500 ms). Se registra como deuda menor en vez de agregar un skeleton a cada subcomponente, para no ampliar el alcance de esta tarea (única integración pedida: la tabla de entregas).
- **El filtrado por sucursal en `logistics` hoy es client-side.** `useDeliveriesStore` sigue cargando el dataset mock completo (todas las sucursales) y `getDeliveriesForDate` filtra en memoria por `date`+`branchId`; la sucursal activa nunca reduce lo que hay en el store, solo lo que `LogisticsPage` muestra. Es correcto para esta etapa (no hay backend, y la firma del servicio — recibir `branchId` como parámetro — ya es la costura pensada para no cambiar cuando exista uno), pero **no es el diseño final**: cuando llegue paginación server-side, el store pasará a contener solo la página/sucursal activa (un fetch por sucursal, no el dataset entero), y `reset()` cambiará de significado — de "volver al array mock completo" a "vaciar el estado y volver a pedir a la API". Se deja anotado para que ese cambio no se lea como una regresión de diseño cuando llegue.

## [01/09/2026] — Inventario multi-depósito (stock y mínimo por sucursal) + `supplierId` tipado

### 1. Contexto
Extiende la infraestructura de sesión/sucursal activa (entrada anterior de este mismo archivo) al módulo `inventory`, que hasta ahora trataba el stock como un número global del producto (`InventoryItem.stock`/`minStock`). Es prerrequisito de dos features futuras ("stock crítico" y "generar orden de compra"). Se investigaron antes de tocar nada: `shared/types/inventory.types.ts`, `shared/types/supplier.types.ts`, `services/mock/products.service.ts`, `services/mock/suppliers.service.ts`, las 9 tabs de `InventoryPage.tsx` y sus componentes, `data/mock/inventory.data.ts`/`suppliers.data.ts`, y el patrón de referencia ya establecido en `logistics` (`useDeliveriesStore`, `deliveries.service.ts`, D4/D5 de la entrada anterior).

### 2. E1 — El stock es una entidad aparte, no un array embebido en el producto
```ts
interface ProductStock {
  productId: InventoryItem['id'];
  branchId: Branch['id'];
  stock: number;
  minStock: number;
}
```
**Por qué (la parte que importa):** el catálogo de productos es de la empresa; el stock es de la sucursal. Son dos cosas con ciclos de vida y volúmenes distintos — el catálogo cambia cuando se da de alta/edita un producto (RF-PRD-001), el stock cambia con cada movimiento en cada sucursal. Con 50.000 productos y 40 sucursales hay 2.000.000 de filas de stock; embeberlas en el producto (`InventoryItem { stockByBranch: {...}[] }`) significa que pedir el catálogo (para el ABM, para un buscador, para cualquier pantalla que no necesita stock) arrastra los 2.000.000 de filas igual. Separadas, una pantalla de stock pide el catálogo (una vez) + el stock de UNA sucursal (un fetch acotado). Además, el día que haya backend esto va a ser dos tablas relacionales distintas — el frontend debe tener la misma forma que la fuente de datos real, no una conveniencia local que después hay que deshacer.

### 3. E2 — `InventoryItem` pierde `stock`/`minStock` — inventario real de consumidores rotos
No quedaron como campos deprecados ni duplicados: se borraron del tipo y se dejó que el compilador (`npx tsc -b --noEmit`) marcara cada consumidor, para medir el alcance real del cambio antes de arreglarlo. Lista completa que devolvió el compilador (7 archivos):
- `src/data/mock/inventory.data.ts` — literales de los 18 productos (`supplier`/`stock`/`minStock`) + `PurchaseSuggestion` sin `branchId`.
- `src/modules/inventory/components/ProductFormModal.schema.ts` — schema y `productFormDefaultValues`.
- `src/modules/inventory/components/StockAdjustmentModal.tsx` — leía `product.stock` directo.
- `src/modules/inventory/components/TabLowStock.tsx` — filtro y columnas.
- `src/modules/inventory/components/TabStockCurrent.tsx` — KPIs y columnas.
- `src/modules/inventory/InventoryPage.tsx` — `handleSaveProduct` (faltaba `supplierId` en el objeto pasado a `createProduct`/`updateProduct`).
- `src/modules/orders/components/create-order/OrderProductsSection.tsx` — **el único fuera de `inventory`**: copiaba `match.stock` de un `InventoryItem` al agregar un producto al pedido.

El último caso tensiona con el alcance declarado (E7, "solo `inventory` y `dashboard`"): `orders` no se tocó por elección, se tocó porque E2 lo rompió. Se resolvió con el cambio mínimo posible — `OrderProductsSection` ahora lee `useSessionStore().activeBranchId` y llama a `getStockForBranch(match.id, activeBranchId)` en vez de leer un campo que ya no existe — sin agregar ninguna feature nueva a `orders` (selector de sucursal propio, edición de stock, etc.). Es la misma clase de fix que ya se le hizo a `StockAdjustmentModal.tsx` (ver punto 6).

### 4. E3 — `supplier: string` (nombre libre) pasa a `supplierId: Supplier['id']`
Import de solo tipo desde `shared/types/supplier.types.ts`, sin import en tiempo de ejecución entre `modules/inventory` y `modules/suppliers` — mismo patrón que `Delivery.orderId: Order['id']` (`[28/08/2026] — Primer Uso Real de zustand...`, punto 7) y que la Opción A ya recomendada (sin implementar) en `[28/08/2026] — Productos Bajo Stock Mínimo`, punto 6, de este mismo archivo. Los 18 productos del mock ahora apuntan a IDs reales de los 3 proveedores de `suppliers.data.ts` (`sup-001` Molinos Cañuelas, `sup-002` Las Marias, `sup-003` Arcor) — antes tenían 13 nombres distintos, la mayoría (Ledesma, Bagley, Clorox, Kimberly-Clark, Unilever, Danone, Bodegas Trapiche, Molinos Rio de la Plata, Coca-Cola Femsa, Quilmes) sin ningún proveedor real detrás.

`ProductFormModal` ya no tiene un `<select>` de proveedor hardcodeado con nombres — `InventoryPage` hace `fetchSuppliers()` (mismo `services/mock/` que ya usa `orders` para leer productos de `inventory`, no es una excepción nueva al patrón) y pasa la lista real como prop; el `<option>` se resuelve por `supplier.id`/`supplier.name`, nunca por coincidencia de string.

### 5. E4 — Acceso al stock por funciones, no por array a mano
`services/mock/products.service.ts` suma, con el mismo patrón `delay` + `structuredClone` que el resto del archivo:
- `getStockForBranch(productId, branchId): Promise<ProductStock | undefined>` — lectura puntual.
- `getStockedProductsForBranch(branchId): Promise<StockedInventoryItem[]>` — catálogo completo (LEFT JOIN) con stock/minStock en 0 para lo no cargado en esa sucursal (E5). Usada por `TabStockCurrent`.
- `getLowStockForBranch(branchId): Promise<StockedInventoryItem[]>` — **tercera función, no pedida explícitamente pero agregada para no reproducir el criterio E5+E6 dentro de un componente**: filtra `stockStore` (no el catálogo completo) por `branchId` + `stock <= minStock`, así que excluye de raíz los productos sin registro en esa sucursal (INNER JOIN, a diferencia de la anterior). Usada por `TabLowStock`. Alternativa descartada: que `TabLowStock` reciba la lista completa de `getStockedProductsForBranch` y filtre `stock > 0 || minStock > 0` a mano — se descartó porque el criterio de exclusión (E5) quedaría como una heurística implícita en un componente en vez de una regla documentada en un solo lugar.

`branchId` viaja como parámetro explícito en las tres, igual que `deliveries.service.ts` (D4 de la entrada anterior): ninguna lee `useSessionStore`.

### 6. E5 — Producto sin registro de stock en una sucursal: criterio por tab
- **`TabStockCurrent` ("catálogo con su stock acá"):** lo muestra en 0 (vía `getStockedProductsForBranch`). Es la vista del maestro de productos (RF-PRD-001) con una columna de stock, no "lo cargado en esta sucursal" — un producto del catálogo sin stock cargado todavía es información real, no un error.
- **`TabLowStock` ("bajo mínimo en esta sucursal"):** lo excluye (vía `getLowStockForBranch`). Un producto sin registro no tiene mínimo definido en esa sucursal, así que no puede estar "bajo su mínimo" ahí — mostrarlo con `minStock: 0` haría parecer que su política es "mínimo cero" en vez de "no cargado todavía".
- **`TabPurchases` (sugerencias por sucursal):** ídem por construcción — `PurchaseSuggestion` es un dato curado aparte (ver punto 8), no derivado del stock, así que un producto sin registro simplemente no tiene sugerencia.

Ningún caso muestra `undefined` ni rompe: verificado en el navegador con `VIN-TIN-750` (sin registro en Sucursal Sur) — aparece en 0 en "Stock Actual" y no aparece en "Bajo Stock Mínimo" de esa sucursal.

### 7. E6 — Bug de "bajo stock" corregido: `stock <= minStock`, no `< estricto`
Era un bug, no una decisión — un producto exactamente en su mínimo debería figurar como "hay que reponer ya", no quedar afuera. Corregido en `getLowStockForBranch` (servicio) y en los indicadores visuales de `TabStockCurrent` (KPI "Stock Bajo" y el color de la celda de stock). Verificado en el navegador: `FID-GUI-500` (60/60) y `ARR-LAR-1K` (90/90) en Sucursal Centro aparecen en "Bajo Stock Mínimo" con déficit `-0`.

### 8. Mock de stock (`data/mock/productStock.data.ts`) y sugerencias por sucursal
Archivo nuevo, separado de `inventory.data.ts` (coherente con E1: son dos entidades). Cubre las 3 sucursales activas (`branch-001`/`002`/`003`); `branch-004` (inactiva) no tiene stock, mismo criterio que ya usa `logistics.data.ts` para entregas. Casos de borde a propósito, verificados los cuatro en el navegador:
- `inv-001` (Aceite Girasol): sano en Centro (450/200) y en 0 en Norte (0/180) — "sin stock acá" vs. sano en otra sucursal.
- `inv-008`/`inv-009` en Centro: `stock === minStock` exacto (60/60, 90/90) — prueba E6.
- `inv-018` (Vino Tinto): sin registro en Sucursal Sur — prueba E5.
- `inv-002` (Yerba Mate): `minStock` distinto en las 3 sucursales (150/100/200).

`PurchaseSuggestion` suma `branchId: Branch['id']` y pasó de 1 a 3 sugerencias (una por sucursal activa, con los mismos números que su registro real en `productStock.data.ts` para esa sucursal). Siguen siendo un dato curado aparte, no derivado automáticamente de `getLowStockForBranch` — mismo criterio que ya regía antes de esta tarea (ver `[28/08/2026] — Productos Bajo Stock Mínimo`, punto 3: `PurchaseSuggestion` es un concepto más específico que "bajo mínimo", con proveedor/cantidad/costo curados). El botón "Generar OC" sigue sin conectar (tarea aparte); `branchId` ya viaja en cada sugerencia para cuando se conecte.

### 9. Sin store de zustand nuevo — justificación (pedida explícitamente en el alcance de esta tarea)
`InventoryPage` no usa un store para el stock: lo pide de nuevo (`getStockedProductsForBranch`/`getLowStockForBranch`) en un `useEffect` con `activeBranchId` (y `products`) como dependencias. Motivo: esta tarea no agrega **ninguna** mutación de stock (movimientos/ajustes de stock quedan fuera de alcance — `TabAdjustments`/`StockAdjustmentModal` siguen sin conectar a ningún servicio real). Un store de zustand con `reset()` + auto-registro en `resettableStores.ts` (patrón de `useDeliveriesStore`/`useReplenishmentStore`) resuelve "no arrastrar estado mutado de la sucursal anterior" — pero acá no hay estado mutado que arrastrar: el refetch disparado por el cambio de `activeBranchId` ya trae los datos correctos de la sucursal nueva, así que un `reset()` sería redundante con el refetch. `useReplenishmentStore` (que si tiene estado mutable — las solicitudes de reposición) no cambió y se sigue reseteando por el mecanismo ya existente.

`isLoadingStock` se calcula comparando "la sucursal que ya se cargó" (`loadedStockBranchId`, seteado dentro del `.finally()` del fetch) contra `activeBranchId`, en vez de un `setState(true)` sincrónico al principio del efecto — la regla de lint `react-hooks/set-state-in-effect` (nueva en este proyecto, no existía cuando se escribió `useDeliveriesStore`) lo marca como error; el mismo criterio ya lo usaba sin saberlo el efecto de `fetchProducts` original (solo hace `setState` dentro de `.then()`/`.finally()`, nunca al inicio del efecto).

### 10. `TabPurchases`/`TabStockCurrent`/`TabLowStock` — indicador visible de sucursal
Cada una de las 3 tabs que muestran stock agrega una línea (`"Mostrando stock de <sucursal>"` / `"Mostrando bajo stock de <sucursal>"` / `"Mostrando sugerencias de <sucursal>"`) además del selector de sucursal ya visible en el header (global, `BranchSelector`). Se decidió no depender solo del header: la consigna explícita era que "un usuario no puede confundir 'sin stock acá' con 'sin stock en la empresa'", y esa ambigüedad ocurre específicamente donde se muestran números de stock, no en toda la pantalla.

### 11. Dashboard — revisado, sin cambios
`dashboard.data.ts`/`dashboard.service.ts`/los componentes de `modules/dashboard/` no importan `InventoryItem` ni ningún tipo de `inventory.types.ts` (verificado por grep antes de decidir) — sus KPIs y gráficos son datos mock propios, independientes del catálogo/stock real. No había ninguna métrica de stock que revisar ni "total global cruzando sucursales" que decidir: no se tocó ningún archivo de `dashboard`.

### 12. `ProductFormModal` — se le sacaron los campos de Stock Inicial/Stock Mínimo
Antes el alta de producto pedía "Stock Inicial" (deshabilitado al editar) y "Stock Mínimo". Como `InventoryItem` ya no tiene esos campos (E2), y cargar el stock inicial de un producto nuevo en una sucursal es un movimiento de stock (fuera de alcance de esta tarea), se sacaron del formulario en vez de dejarlos escribiendo a ningún lado. Un producto recién creado arranca sin registro de stock en ninguna sucursal — se ve en 0 en todos lados (E5), hasta que se cargue por la vía que corresponda (movimientos/ajustes, tarea futura).

### 13. Verificación funcional realizada en el navegador
`npm run dev` + Chrome real sobre `/inventario` y `/pedidos`, con `C:\proyectos\SDGPD` (no la copia de OneDrive). Confirmado visualmente: cambio de sucursal (Norte → Sur → Centro) actualiza los números y el texto de "mostrando stock/bajo stock/sugerencias de X"; la paginación de "Bajo Stock Mínimo" vuelve a página 1 al cambiar de sucursal (se dejó en página 2 de Sur antes de cambiar); una solicitud de reposición hecha en Sucursal Sur se resetea a "Sin solicitar" al pasar a Centro (mecanismo D5 de la entrada anterior, sin cambios); `VIN-TIN-750` en Sucursal Sur en 0 sin romper nada; `FID-GUI-500`/`ARR-LAR-1K` (exactos en su mínimo) aparecen en "Bajo Stock Mínimo" de Centro; el selector de proveedor en "Nuevo Producto"/"Editar Producto" muestra los 3 proveedores reales y preselecciona el correcto por ID al editar `ACE-GIR-15`; agregar un producto en "Nuevo Pedido" (`orders`) toma el stock de la sucursal activa (450 en Centro, coincide con `productStock.data.ts`); Dashboard renderiza sin errores; consola sin errores nuevos en ninguna de las dos pantallas.

**No verificado en el navegador:** el skeleton de "sin sucursal activa todavía" (la carga de sesión mock tarda ~500ms, ventana muy corta para capturarla de forma confiable con las herramientas de automatización disponibles) — se verificó por lectura de código que sigue el mismo patrón ya probado en `LogisticsPage` (`activeBranchId ? <contenido> : <SkeletonTable>`).

## [01/09/2026] — Contrato de datos paginado server-side (infraestructura, sin features nuevas)

### 1. Contexto
Cambia el contrato de datos de listados para que paginación, filtrado y orden se resuelvan en el origen de datos (hoy `services/mock/*`, mañana un backend real) y no en el navegador — prerrequisito de clientes morosos y stock crítico, las dos features de mayor volumen del sistema. Alcance limitado a los únicos 2 consumidores que ya usaban el patrón de tabla paginada (P8): `LogisticsPage` y `TabLowStock`. Se leyó antes de tocar nada: `usePagination.ts`, `Pagination.tsx`, `Table.tsx`, ambos consumidores completos (`LogisticsPage`, `LogisticsKPIs`, `DeliveryFilters`, `DeliveriesTable`, `useDeliveriesStore`, `deliveries.service.ts`, `TabLowStock`, `InventoryPage`), `products.service.ts`, y los mocks (`logistics.data.ts`, `productStock.data.ts`).

### 2. P1 — El servicio mock hace de backend, no de repositorio
`deliveries.service.ts#getDeliveriesPage` y `products.service.ts#getLowStockPage` filtran, ordenan, cuentan y cortan ellos — nunca devuelven el dataset completo para que el componente lo procese. Mismo patrón `delay` + `structuredClone` que ya usaba el resto de `services/mock/`. Motivo (literal de la tarea, y es el correcto): si el mock devuelve todo, el contrato queda sin probar y el día que exista backend real aparecen los bugs recién ahí — el mock tiene que "mentir bien", comportándose como si la paginación/el filtrado ya pasaran por la red.

### 3. P2/3.1 — Contrato tipado en `shared/types/pagination.types.ts`
```ts
interface PageQuery<TFilters, TSort extends string = string> {
  page: number; pageSize: number; filters: TFilters;
  sort?: { field: TSort; direction: 'asc' | 'desc' };
}
interface PageResult<TItem, TAggregates = undefined> {
  items: TItem[]; total: number; page: number; pageSize: number;
  aggregates?: TAggregates;
}
```
`TFilters` tipado por consumidor (`DeliveryQueryFilters`, `LowStockQueryFilters` — nunca `Record<string, unknown>`). `page` en la respuesta puede diferir del pedido: si la página pedida quedó fuera de rango (el total bajó, ej. por una mutación — ver P10), el servicio devuelve la última página válida en `result.page` en vez de un array vacío, y quien consume el contrato se realinea con ese valor.

### 4. P3 — Por qué los agregados no se calculan en el cliente (lo más importante de la tarea)
Un KPI o un contador calculado sobre las 8-25 filas de una página, en un dataset de cientos de miles, es un número incorrecto en pantalla — no una aproximación aceptable, un dato mal mostrado. `PageResult.aggregates` es opcional y tipado por consumidor (`DeliveryAggregates`, ninguno para `getLowStockPage` — ver punto 8), nunca `any`. Regla vigente desde ahora, sin excepción: **ningún componente calcula un total, un conteo ni un promedio sobre `items`.**

`DeliveryAggregates` (`deliveries.service.ts`):
```ts
interface DeliveryAggregates {
  countByStatus: Record<DeliveryStatus, number>;
  totalForScope: number; // suma de countByStatus, ya resuelta por el servicio
  pendingCollectionAmount: number;
}
```
`totalForScope` es literalmente la suma de los 3 valores de `countByStatus` — se manda igual, resuelta, para que ni siquiera esa suma trivial quede del lado del cliente. Los agregados se calculan sobre **fecha+sucursal, sin aplicar el filtro de estado** (a propósito): así los contadores de `DeliveryFilters` ("Pendiente 2", "En Ruta 3", etc.) y los KPIs de `LogisticsKPIs` no cambian según cuál estado esté seleccionado — mismo comportamiento que tenía la pantalla antes de paginar, cuando ambos leían del array `todayDeliveries` (día+sucursal) sin el filtro de estado aplicado. Verificado en el navegador: aplicar el filtro "En Ruta" cambia la tabla y el total, pero no los KPIs ni los demás contadores del filtro.

### 5. P4 — `usePagedQuery` reemplaza a `usePagination` (nombre distinto, no alias)
`usePagination` cortaba un array ya en memoria (`items.slice(...)`). El hook nuevo no conoce ningún array completo: recibe `fetchPage` (la función del servicio) y `filters` tipados, maneja pagina/tamaño/orden internamente y dispara el fetch. Llamarlo `usePagination` habría sido un nombre que miente sobre lo que hace — se prefirió el nombre honesto (`usePagedQuery`) a mantener compatibilidad de nombre con una API completamente distinta. `usePagination.ts` se eliminó (cero consumidores fuera de los 2 migrados).

Genérico y sin conocimiento de dominio (`usePagedQuery<TItem, TFilters, TSort, TAggregates>`): no importa `Delivery`, `DeliveryStatus` ni ningún tipo de `inventory`/`logistics`. Requisito para quien lo use: `fetchPage` debe ser una referencia estable (una función exportada de un servicio) — está en las dependencias del efecto que dispara el fetch, y una función nueva en cada render dispararía un fetch en loop; documentado en el propio archivo.

`filters` se compara por referencia durante el render (mismo patrón que el `resetKey` del `usePagination` anterior, sin agregar un efecto nuevo) para decidir cuándo volver a página 1 — el llamador debe memoizar `filters` con `useMemo`. Como `branchId` viaja dentro de `filters` (P9), un cambio de sucursal entra por la misma vía que un cambio de filtro de estado, sin código aparte.

### 6. P5 — Respuestas fuera de orden y estado de carga por página (la otra parte de más riesgo)
Dos mecanismos separados:
- **Descarte de respuestas viejas:** el efecto que dispara el fetch usa el mismo patrón `let cancelled = false; ...; return () => { cancelled = true }` que ya usaba el resto del proyecto (`InventoryPage`, etc.), no uno nuevo. Si el usuario cambia de página/filtro/orden antes de que un fetch anterior resuelva, React ejecuta el cleanup de ESE efecto (marca `cancelled = true`) antes de correr el efecto nuevo — la respuesta tardía nunca pisa el estado con datos de una consulta que ya no es la vigente.
- **`isFetching` sin vaciar `items`:** `items`/`aggregates` sólo se reemplazan cuando una respuesta no cancelada llega — nunca se limpian al empezar un fetch. `isFetching` se pone en `true` de forma sincrónica, pero **nunca dentro del efecto** (eso dispara la regla de lint `react-hooks/set-state-in-effect`, ya conocida de la tarea anterior): se marca en los manejadores de evento (`setPage`, `setPageSize`, `setSort`, `refetch`) y en el bloque de "cambiaron los filtros" durante el render — ambos casos son manejadores/ajuste-de-estado-durante-render, no el cuerpo de un efecto, así que no disparan la regla. Se apaga siempre dentro del `.finally()` del fetch (asíncrono, sin problema de lint). Cada setter se guarda de marcar `isFetching` si el valor no cambia de verdad (ej. `setPage` con la misma página), para no dejarlo trabado en `true` sin que el efecto vuelva a correr y lo apague.

`shared/components/ui/FetchingOverlay.tsx` (nuevo, genérico): envuelve la tabla y, mientras `isFetching`, la atenúa (opacity, `pointer-events: none`) y muestra un spinner + "Actualizando..." (`role="status"`, `aria-live="polite"`) encima — nunca la vacía ni la reemplaza por un skeleton. El skeleton de carga completa (`SkeletonTable`) sólo se usa mientras `isLoading` (todavía no llegó la primera respuesta de la consulta actual); una vez que hay datos, todo cambio posterior (página, tamaño, orden, `refetch`) usa `FetchingOverlay`, nunca vuelve al skeleton — evita el salto de layout y el parpadeo de "tabla vacía" en cada click.

Verificado en el navegador: clicks rápidos en botones opuestos (anterior/siguiente) en `TabLowStock` con `pageSize=10` (13 productos, 2 páginas) siempre asentaron en un estado coherente — el pie de página (`Página X de Y`, `Mostrando A-B de C`) y las filas mostradas coincidieron entre sí en cada intento, nunca una mezcla. No se pudo capturar visualmente el frame intermedio con el spinner encendido (el delay simulado, 400ms, es más corto que el round-trip de captura de pantalla de las herramientas de automatización disponibles) — confirmado por lectura de código y por la consistencia del estado final en cada prueba.

### 7. P10 — `advanceDeliveryStatus` con paginación server-side: refetch de la página actual, no actualización optimista
Decisión: `LogisticsPage#handleAdvanceStatus` espera la mutación (`advanceDeliveryStatus`, ahora async) y, si tiene éxito, llama a `refetch()` del hook en vez de actualizar `deliveries`/`aggregates` en el cliente.

**Por qué no optimista:** una actualización optimista de la entrega es fácil (`map` sobre `items` y cambiar el estado de una fila), pero `countByStatus`/`totalForScope`/`pendingCollectionAmount` también cambian con esa transición — actualizarlos a mano en el cliente es exactamente el cálculo de agregados sobre datos locales que P3 prohíbe, y además duplica en el cliente la lógica de agregación que ya vive en el servicio (dos lugares para el mismo cálculo, que pueden divergir). Refetch es más lento (~400ms extra visibles) pero mantiene una única fuente de verdad para los agregados. Verificado en el navegador: avanzar una entrega de "Pendiente" a "En Ruta" actualiza la tabla, el contador de "Pendiente"/"En Ruta" del filtro y el KPI "Entregas del Día" en el mismo golpe, sin desincronía entre ellos.

**`useDeliveriesStore` se elimina, no se conserva con un rol nuevo.** La entrada anterior (`[01/09/2026] — Contexto de sesión y sucursal activa`, punto 9) había anotado como limitación conocida que el store "pasaría a contener solo la página/sucursal activa" cuando llegara paginación server-side. Al implementarlo se decidió lo contrario, y por una razón concreta: con `branchId` viajando en `filters` (P9), un cambio de sucursal ya dispara un refetch por sí solo a través de la comparación de `filters` en `usePagedQuery` (punto 5) — no queda ningún motivo para "resetear" un store de entregas al cambiar de sucursal, porque ya no hay un array completo en memoria del que una sucursal vieja pueda quedar mostrándose. La lista de la página actual vive en el estado interno del propio `usePagedQuery` de `LogisticsPage`, no en un store aparte; y la mutación de estado de una entrega (`advanceDeliveryStatus`) pasó a ser una función async de `deliveries.service.ts` que muta la variable de módulo `deliveriesStore` (mismo patrón que `productsStore`/`stockStore` de `products.service.ts`), no una acción de zustand. Mantener `useDeliveriesStore` como una cáscara que sólo reflejara la página actual habría sido estado duplicado sin ningún consumidor que lo necesitara — se documenta acá la desviación de lo anotado antes, con la razón concreta, en vez de dejar la nota vieja como si el diseño final hubiera sido ese.

### 8. 3.4 — Orden determinístico con desempate estable por id
Con datos paginados, un criterio de orden ambiguo (ej. "por horario estimado" cuando dos entregas comparten el mismo horario) hace que una misma fila pueda aparecer en dos páginas distintas o en ninguna, según en qué momento se pida cada página. `getDeliveriesPage` y `getLowStockPage` comparan primero por el campo de orden pedido (o el default: `estimatedTime` para entregas, `sku` para bajo stock) y, si empatan, por `id` (`localeCompare`) — el `id` es único, así que el desempate siempre resuelve un orden total, no solo parcial. Verificado en el navegador: dos entregas de Sucursal Centro con el mismo horario (`del-001`/`del-006`, ambas "08:00 - 10:00") aparecen siempre en el mismo orden (`del-001` antes que `del-006`) sin importar cuántas veces se recarga la página.

### 9. P6 — `Pagination.tsx`: salto de página y tamaño, sin duplicar el default
Anterior/siguiente sobre miles de páginas es inservible. Se agregó, reutilizando el mismo componente (no uno nuevo por consumidor, R3): un `<select>` de tamaño de página (`shared/components/ui/paginationDefaults.ts` → `PAGE_SIZE_OPTIONS = [10, 25, 50, 100]`, archivo separado de `Pagination.tsx` porque un componente sólo puede exportar componentes — `react-refresh/only-export-components`, mismo criterio que `deliveryStatusLabels.ts`) y un formulario de salto directo (`<input type="number">` + botón "Ir", con `<form onSubmit>` para que Enter también funcione). El input de salto se resincroniza con `currentPage` cuando cambia desde afuera comparando durante el render (mismo patrón que el resto del proyecto), sin un efecto nuevo.

`DEFAULT_PAGE_SIZE = 25` vive en `usePagedQuery.ts` (un solo lugar): ningún consumidor lo hardcodea — ni `LogisticsPage` ni `TabLowStock` pasan `pageSize` a `usePagedQuery`, así que ambos heredan el mismo default sin repetirlo.

**Accesibilidad:** cada control tiene `aria-label`/`<label>` propio ("Filas por página", "Pagina anterior", "Pagina siguiente", "Numero de pagina", "Ir a la pagina ingresada"); el indicador "Página X de Y" y el resumen "Mostrando X-Y de Z" llevan `aria-live="polite"` para que un cambio de página se anuncie. Todos los controles son elementos nativos (`<button>`, `<select>`, `<input>`, `<form>`), navegables por teclado sin código adicional — verificado leyendo el árbol de accesibilidad del componente en el navegador (nombres accesibles correctos en los 6 controles) y operando el selector de tamaño y el salto de página con teclado (flechas + Enter) durante la verificación funcional.

### 10. P7 — Sin virtualización (decisión, no implementación)
Con paginación server-side, el DOM nunca recibe más filas que `pageSize` (25 por defecto, máximo 100 con el selector) — no hay una lista de miles de filas en memoria del cliente que virtualizar. Agregar una librería de virtualización habría sido resolver un problema que el propio cambio de esta tarea ya eliminó, además de violar la norma de no-duplicación de dependencias (`[25/08/2026] — Utilidades Esenciales del Frontend`) sin necesidad concreta. No se instaló ninguna dependencia nueva.

### 11. Dashboard y `OrderProductsSection` — revisados, con una observación para la salida de la tarea
`dashboard` no se tocó (no consume `Delivery` ni `StockedInventoryItem`, ver entrada anterior). `OrderProductsSection.tsx` tampoco se tocó (explícitamente fuera de alcance) — pero **su pendiente conocido (el `await` del escaneo de código de barras puede recibir una respuesta tardía fuera de orden si el usuario escanea/tipea rápido) es la misma clase de problema que P5 resuelve acá.** El día que se aborde ese pendiente, el patrón ya probado en `usePagedQuery` (cleanup con `cancelled` en el efecto que dispara el fetch) es el que corresponde reusar, no uno nuevo — queda anotado para esa tarea futura, no implementado ahora.

### 12. Verificación funcional realizada en el navegador
`npm run dev` + Chrome real sobre `/logistica` y `/inventario` (`C:\proyectos\SDGPD`). Confirmado: lista y paginación de Logística cargan correctamente por sucursal; los KPIs no cambian al aplicar el filtro de estado ni al cambiar de página; filtro "En Ruta" corta la tabla y el total sin tocar los demás contadores; cambio de sucursal (Sur → Centro) actualiza datos y mantiene el filtro de estado elegido; avanzar una entrega (`del-003`, Sucursal Sur) refleja el nuevo estado y actualiza KPIs/contadores en el mismo golpe (P10); en Bajo Stock Mínimo, cambio de tamaño de página (25 → 10) parte 13 productos en 2 páginas de forma coherente; salto directo a página 2 y a página 99 (clampada a la última válida, 2) funcionan; filtro "Pendiente" en una sucursal sin pendientes muestra "No hay entregas para el día y estado seleccionados." con los controles de paginación intactos (`Mostrando 0-0 de 0`, sin romperse); el reset de reposición al cambiar de sucursal (Sur → Norte → Sur) sigue funcionando sin cambios; consola sin errores nuevos tras recargar ambas pantallas.

**No verificado / verificado parcialmente:**
- El frame intermedio con el spinner de `FetchingOverlay` encendido no se pudo capturar en una captura de pantalla (ver punto 6) — confirmado por lectura de código y por la consistencia del estado final tras clicks rápidos.
- El dataset real de Logística (máximo 8 entregas por sucursal/día) nunca genera más de una página al tamaño mínimo disponible (10): el salto de página y los clicks rápidos entre páginas no distantes se probaron ahí de forma limitada; la cobertura completa de esos casos (múltiples páginas reales, salto entre páginas lejanas) se hizo en Bajo Stock Mínimo, que comparte exactamente el mismo hook (`usePagedQuery`) y el mismo componente (`Pagination`) — no hay lógica de paginación distinta entre ambas pantallas que quedara sin probar.

## [01/09/2026] — Clientes morosos / deuda vencida (primera feature de negocio sobre el contrato de paginación)

### 1. Contexto
Primera pantalla de negocio construida sobre la infraestructura de las tres tareas anteriores (sesión/sucursal, stock por sucursal, contrato de paginación server-side). Se leyó antes de tocar nada: `shared/types/client.types.ts`, `services/mock/clients.service.ts`, `data/mock/clients.data.ts`, `ClientsPage.tsx`, `ClientAccountsTable.tsx`, `ClientDirectoryTable.tsx`, `ClientFilters.tsx`, y el patrón de referencia ya establecido (`usePagedQuery`, `Pagination`, `FetchingOverlay`, `deliveries.service.ts`, `TabLowStock.tsx`). Discrepancia encontrada contra el enunciado: `clients.data.ts` tenía 3 clientes, no 8 — se registra por honestidad, no cambia nada del resto.

### 2. M1 — `dueDate` solo en facturas: union discriminada, no un campo opcional
`ClientTransaction` pasa a ser `ClientInvoiceTransaction | ClientPaymentTransaction | ClientAdjustmentTransaction`, discriminada por `type`. Solo la primera tiene `dueDate`. Se descartó `dueDate?: string` opcional en un tipo base único: un pago o un ajuste con `dueDate: undefined` "porque no aplica" es un campo que miente por omisión — cualquiera que lea el tipo tiene que saber de memoria que solo las facturas lo llenan. Con la unión, TypeScript directamente no deja escribir `dueDate` en un pago ni leerlo sin antes verificar `type === 'invoice'` — el compilador impone la regla de negocio en vez de dejarla en un comentario.

### 3. M2 — Imputación FIFO: la regla de negocio y sus tres casos explícitos
**Regla:** los pagos y los ajustes con `credit > 0` cancelan las facturas más viejas primero (ordenadas por `date` de emisión). Se implementa sumando **todo** el pool disponible (pagos + ajustes-crédito históricos del cliente) y aplicándolo a las facturas en orden de antigüedad — no se simula la imputación pago-por-pago en el momento histórico exacto en que ocurrió. Esto es matemáticamente equivalente para el estado final: lo único que determina cuánto queda abierto en cada factura es *cuánto dinero llegó en total* y *en qué orden de antigüedad se cancelan las facturas* — no en qué momento exacto llegó cada pago individual, porque estamos calculando una foto del estado actual, no una animación. Se verificó esta equivalencia con ejemplos a mano antes de implementarla (ver el comentario en `imputeOpenInvoices`, `clients.service.ts`).

**Los tres casos pedidos, resueltos:**
- **Pago parcial:** la factura queda abierta por `debit - aplicado` (`openBalance`), nunca en 0 ni por el monto original. Mock: `cli-007` (Kiosco Central, factura $60.000 con pago parcial de $20.000 → abierta en $40.000) y `cli-016` (Despensa Rivadavia, pago + ajuste-crédito combinados). Verificado en el navegador: ambos muestran exactamente $40.000,00 de deuda vencida.
- **Pago que excede el total:** el sobrante del pool después de cancelar todas las facturas simplemente no se usa (no genera una entidad "saldo a favor" en el tipo, porque no hace falta: el resultado natural es que la factura queda en `openBalance = 0` y el cliente no tiene ninguna factura abierta, así que ni siquiera entra al snapshot de morosos — ver punto 6). Mock: `cli-008` (Maxikiosco Norte, `currentBalance: -15000`). Verificado: no aparece en "Clientes Morosos".
- **Ajustes:** un ajuste con `credit > 0` (nota de crédito / descuento) se suma al pool igual que un pago — se imputa FIFO sin excepción. Un ajuste con `debit > 0` (nota de débito / recargo) **no se imputa contra ninguna factura y no genera un ítem vencible propio** — no tiene `dueDate` (M1), así que no puede entrar en un tramo de mora por sí mismo; queda reflejado solo en los totales legacy de la cuenta (`totalDebit`/`currentBalance`), fuera del cálculo de aging de esta vista. Mock: `cli-019` (Almacén Alberdi, factura $70.000 + nota de débito $5.000 que NO la reduce ni la infla). Verificado en el navegador: la deuda vencida mostrada es exactamente $70.000,00, sin el recargo.

Se documentan estos tres casos acá — y no solo en el código — porque son decisiones de negocio (qué hacer con la plata), no detalles de implementación: si mañana cambia el criterio (por ejemplo, que un ajuste de débito sí generara un ítem vencible con una fecha propia), es una decisión de producto nueva, no un bug a corregir.

### 4. M3 — Tramos de aging: `1-30` / `31-60` / `61-90` / `90+`, calculados sobre facturas abiertas
Después de la imputación FIFO, cada factura con `openBalance > 0` se compara contra "hoy": si `dueDate` es futura, `bucket: null` (no vencida, no entra en ningún tramo — verificado con `cli-011` y la factura futura de `cli-026`, ninguna aparece en "Clientes Morosos" por esa factura). Si ya venció, `daysOverdue = hoy - dueDate` en días, y el tramo sale de `daysOverdue`: `≤30`, `≤60`, `≤90`, el resto `90+`. Un día vencido exacto (`daysOverdue === 1`) ya cuenta como vencida — se usa `> 0` estricto, no `≥ 0`, para que una factura que vence *hoy* todavía no sea mora (borde probado a propósito con `cli-001`, vencida hace 2 días, en el límite inferior del tramo 1-30).

### 5. M4 — Agregados de aging: por qué `totalOverdue` nunca se suma en el cliente, ni siquiera el total general
`AgingBucketAggregate` (`bucket`, `currency`, `totalOverdue`, `clientCount`) se calcula en `computeAggregates` (`clients.service.ts`) sobre las facturas vencidas de los clientes que matchean la búsqueda — **sin aplicar el filtro de tramo**, mismo criterio que `DeliveryAggregates` en logística (la búsqueda acota el universo, como fecha+sucursal; el tramo es la faceta que el usuario togglea, y no debe cambiar los totales de las otras facetas). Verificado en el navegador: aplicar el filtro "1-30 días" deja la tabla con 7 filas, pero el resumen de arriba sigue mostrando los 4 tramos con sus totales completos.

`clientCount` cuenta clientes **distintos** con al menos una factura vencida en ese tramo específico — un cliente con facturas en dos tramos (ej. `cli-006`, con una en 1-30 y otra en 61-90) cuenta en los dos, igual que un reporte de antigüedad de saldos tradicional. Esto es intencional y se verificó explícitamente: con 21 clientes morosos, la suma de `clientCount` de los 4 tramos da 25 (9+6+5+5) — los 4 clientes de la tarjeta "varios tramos a la vez" (`cli-006`, `cli-015`, `cli-023`, `cli-027`) explican la diferencia.

La tarjeta "Todos los tramos" muestra `totalItems` (el total de la respuesta paginada, un conteo real de clientes distintos) en vez de sumar `clientCount` de los 4 tramos — sumar esos 4 números en el cliente sería inflado (25, no 21, por el motivo del párrafo anterior) y además sería exactamente el cálculo trivial que P3 prohíbe. No se agregó tampoco un "total en pesos" para esa tarjeta (solo el conteo de clientes): un gran total en $ hubiera necesitado agruparse por moneda igual que los tramos (M5), y no se pidió — se prefirió no mostrar un número a mostrar uno mal etiquetado.

### 6. M5 — Moneda en las transacciones, agregados agrupados por moneda
`Currency = 'ARS'` (unión de un solo miembro, con un comentario explicando que agregar un código ISO 4217 nuevo ahí alcanza para que la agrupación por moneda ya existente empiece a separarlos, sin tocar `computeAggregates`). Cada `ClientTransaction` lleva su propio `currency`. Los agregados (`AgingBucketAggregate`) tienen `bucket` + `currency` como clave compuesta — hoy siempre hay una sola entrada por tramo (todo ARS), pero el código nunca asume "una sola moneda": itera las monedas presentes en los datos, no un valor hardcodeado. No se implementó ninguna conversión ni cotización (fuera de alcance, M5 explícito).

**Corrección posterior (C1, ver la entrada `[01/09/2026] — Correcciones de moneda y aging` más abajo): esta afirmación era incompleta.** `AgingBucketAggregate` (los agregados por tramo) siempre estuvo bien agrupado por moneda — pero la imputación FIFO y el total por cliente (`OverdueClientRow`) NO lo estaban: mezclaban monedas en un solo pool y en un solo número. No se detectó en esta entrada porque el mock era 100% ARS y el bug no tenía forma de manifestarse. Se deja esta nota en el lugar donde se afirmó incorrectamente, en vez de reescribir el texto original, para que quede rastreable qué se creyó cierto y cuándo se corrigió.

### 7. 3.3 — Dónde vive el cómputo de la imputación FIFO (la parte de más riesgo)
La imputación FIFO es una función pura de los datos crudos (`clientsStore`): no depende de la página, el término de búsqueda, el tramo filtrado ni el orden pedido. Recalcularla en cada `getOverdueClientsPage` sería recorrer las transacciones de **todos** los clientes en cada request — con 50.000 cuentas, pedir la página 5 reimputaría las 50.000 cuentas de nuevo solo para descartar casi todo el resultado.

**Decisión:** un cache a nivel de módulo (`overdueSnapshotCache`) invalidado por **referencia** contra `clientsStore`:
```ts
let overdueSnapshotCache: { computedFor: ClientAccount[]; snapshot: OverdueSnapshotEntry[] } | null = null;

function getOverdueSnapshot(): OverdueSnapshotEntry[] {
  if (overdueSnapshotCache && overdueSnapshotCache.computedFor === clientsStore) {
    return overdueSnapshotCache.snapshot;
  }
  const snapshot = computeOverdueSnapshot(clientsStore);
  overdueSnapshotCache = { computedFor: clientsStore, snapshot };
  return snapshot;
}
```
`clientsStore` es reasignado (no mutado in-place) por `createClient`/`updateClient` — mismo patrón que `productsStore` en `products.service.ts` — así que comparar la referencia es una forma barata y correcta de saber "¿cambiaron los datos crudos desde la última vez que imputé?". `getOverdueClientsPage` llama a `getOverdueSnapshot()` y **después** filtra por búsqueda/tramo, ordena, pagina y calcula agregados sobre el snapshot ya calculado — esas operaciones sí son por-request (dependen de la query), pero son baratas (recorren como mucho la cantidad de clientes morosos, no sus transacciones). Pedir la página 5 nunca vuelve a tocar `transactions`.

Se descartó memoizar por página (cachear el resultado ya paginado): la combinación de página × tamaño × búsqueda × tramo × orden es demasiado grande para que valga la pena, y el costo real (recorrer transacciones) ya está resuelto por el cache del snapshot — filtrar/ordenar/paginar un array de clientes ya imputados es barato incluso sin memoizar.

**Corrección posterior (C2, ver la entrada `[01/09/2026] — Correcciones de moneda y aging` más abajo):** esta invalidación por referencia era necesaria pero no suficiente. `computeOverdueSnapshot` usa `new Date()` para calcular días de mora y tramos, y el cache no tenía forma de detectar que "hoy" había cambiado si `clientsStore` seguía siendo la misma referencia — una sesión abierta que cruzara la medianoche seguía sirviendo el aging del día anterior. Se agregó una segunda condición de invalidación (el día calendario con el que se calculó el snapshot); el criterio de invalidación por referencia de `clientsStore` en sí no cambió, solo dejó de ser el único.

### 8. M6 — Búsqueda server-side con debounce: dónde vive y por qué (ver también COMPONENTES_Y_LAYOUTS.md)
`useDebouncedValue` (`shared/hooks/`) es genérico, sin conocimiento de dominio — devuelve el valor recién después de 300ms sin cambios. Vive en `ClientsPage.tsx`, no dentro de `ClientAccountsTable`/`ClientOverdueTable`: las dos tabs paginadas comparten el mismo input de búsqueda de arriba (`ClientFilters`), así que un solo debounce alcanza — tener uno por tab hubiera disparado el mismo fetch dos veces por cada tecla si ambas tabs estuvieran montadas. El **directorio** (`ClientDirectoryTable`, fuera de alcance) sigue usando el valor crudo, sin debounce: filtra un array ya cargado en memoria, no dispara ningún fetch, así que frenarlo no evita nada — solo metería una demora artificial de 300ms a algo instantáneo.

**Cómo se verificó (no se asumió):** se instrumentó temporalmente `useDebouncedValue` con dos `console.log` (uno por cambio del valor crudo, otro cuando se aplica el valor debounced), se tipeó "Sarmiento" (9 caracteres) de una sola vez en el navegador real, y se leyó la consola: **9** logs de "valor crudo cambió" (uno por letra) contra **1** solo log de "valor DEBOUNCED aplicado" — confirma que sobre 9 cambios de tecla se disparó un único fetch, no nueve. La instrumentación se retiró antes de terminar la tarea (no queda en el código final).

### 9. M7 — Tab nueva + migración de `ClientAccountsTable`; alcance de filtros de la migración
`ClientOverdueTable.tsx` (tab "Clientes Morosos") es una vista nueva, no reemplaza nada. `ClientAccountsTable.tsx` se migró de una `<table>` HTML propia sin paginar a `Table` compartido + `usePagedQuery` + `clients.service#getClientAccountsPage`, con el mismo tratamiento visual (badges, "Límite Excedido", fila roja) que tenía antes.

**Decisión de alcance no trivial:** antes de esta tarea, `ClientAccountsTable` recibía el mismo array ya filtrado por zona/vendedor/estado que `ClientFilters` aplicaba para el Directorio. `ClientAccountsQueryFilters` (el contrato paginado nuevo) **solo tiene `search`** — zona/vendedor/estado dejaron de aplicar a esta tab. M7/3.5 piden explícitamente "migrar al contrato paginado, **con búsqueda**" y no mencionan esos otros tres filtros; agregarlos al contrato paginado hubiera sido diseñar filtros que no se pidieron (contradice la norma de no construir para requisitos hipotéticos). Es un cambio de comportamiento visible (esos 3 controles ya no afectan la tabla de Cuentas Corrientes, solo el Directorio) y se registra acá explícitamente para que no se lea como un descuido — si se necesitan de vuelta, es una extensión concreta y acotada del contrato (`ClientAccountsQueryFilters`), no una tarea nueva de alcance grande.

**Limitación conocida, no resuelta:** crear o editar un cliente desde el modal no refresca automáticamente la página actual de `ClientAccountsTable`/`ClientOverdueTable` si ya están montadas (mismo comportamiento que `TabLowStock` no se refresca cuando se edita un producto desde otra pestaña — ver tarea de paginación server-side). Se evaluó agregar un token de refetch pasado por prop, pero `usePagedQuery#refetch` no es una referencia estable entre renders, así que dispararlo desde un efecto externo hubiera necesitado lógica adicional no trivial para un caso de uso menor (crear un cliente nuevo nunca lo hace aparecer en morosos, porque arranca sin transacciones) — se dejó sin resolver, consistente con el resto del proyecto.

### 10. M8 — `ClientAccount.status` sin tocar; "moroso" se deriva de las facturas
No se tocó el tipo `'Al dia' | 'Con Deuda'` (deuda técnica ya registrada). `ClientOverdueTable` nunca lee `status`: un cliente aparece en "Clientes Morosos" únicamente si `computeOverdueSnapshot` encuentra al menos una factura con `bucket !== null` — es decir, abierta y vencida. Verificado explícitamente: `cli-026` tiene `status: 'Con Deuda'` (por una factura futura, todavía no vencida) y no aparece en la tab de morosos.

### 11. M9 — Sin `branchId` en los filtros
`OverdueClientsQueryFilters`/`ClientAccountsQueryFilters` no tienen `branchId`: un cliente es de la empresa, no de una sucursal (M9 explícito). Ninguno de los dos servicios lee `useSessionStore`.

### 12. M10 — Botones decorativos: sin cambios
"Registrar Pago"/"Ver Historial"/"Reclamar Deuda" en `ClientAccountsTable` siguen sin `onClick` — se migró el markup tal cual (mismos íconos, mismo `title`, misma condición `daysOverdue > 0` para el botón de WhatsApp), sin conectar nada.

### 13. Mock (`data/mock/clients.data.ts`) — 29 clientes, casos de borde explícitos
Fechas relativas a "hoy" (mismo `shiftDays` que `logistics.data.ts`) para que los tramos de aging no queden desactualizados con el paso del tiempo real. 21 de los 29 tienen deuda vencida (para poder probar paginación en "Clientes Morosos" con tamaño de página reducido: 21 da 3 páginas a 10 por página, con la última parcial). Casos de borde cubiertos y verificados uno por uno en el navegador: factura recién vencida (`cli-001`, 2 días), al día sin transacciones (`cli-009`/`cli-022`), al día con factura vieja pagada (`cli-004`/`cli-017`/`cli-024`), deuda en varios tramos a la vez (`cli-006`/`cli-015`/`cli-023`/`cli-027`), pago parcial (`cli-007`/`cli-016`), saldo a favor (`cli-008`), factura no vencida todavía (`cli-011`/`cli-026`), límite de crédito excedido (`cli-003`/`cli-010`/`cli-023`), y ajuste de débito que no se imputa (`cli-019`).

### 14. Índices con Map / sin `find()` dentro de `map()`
`getClientAccountsPage`/`getOverdueClientsPage` no tienen un join entre colecciones separadas (a diferencia de `products.service.ts`, que cruza `productsStore` con `stockStore`): cada `ClientAccount` ya trae sus propias `transactions` anidadas, así que no hay un `find()` repetido dentro de un `map()` que optimizar con un `Map` — se deja registrado por qué no aplica acá, no porque se haya pasado por alto.

### 15. Verificación funcional realizada en el navegador
`npm run dev` + Chrome real sobre `/clientes` (`C:\proyectos\SDGPD`). Confirmado: "Clientes Morosos" carga con 21 clientes; ninguno de los 8 clientes "al día"/no-vencidos aparece; los 4 tramos y sus totales no cambian entre página 1, 2 y 3 (con tamaño 10); página 3 muestra exactamente el último cliente parcial; filtro por tramo "1-30" corta a 7 filas sin tocar los totales de arriba y vuelve a página 1; pago parcial y ajuste-crédito muestran el saldo correcto ($40.000 en dos casos distintos); saldo a favor no aparece; ajuste de débito no infla la deuda vencida ($70.000 exactos); cliente con deuda en dos tramos muestra el tramo más viejo y la suma de ambos; búsqueda por nombre ("Sarmiento") y por CUIT (`27-12345678-0`) devuelven el resultado correcto y vuelven a página 1; búsqueda sin resultados muestra el mensaje de vacío con la paginación intacta; debounce confirmado con instrumentación temporal (9 teclas → 1 fetch, ver punto 8); "Cuentas Corrientes" migrada muestra los mismos 29 clientes paginados (25+4, última página parcial), con badges y "Límite Excedido" intactos; controles de paginación operados por teclado (flechas + Enter en el selector de tamaño, Enter en el salto de página) en pruebas de esta tarea y las anteriores; consola sin errores nuevos tras recargar.

**No verificado / verificado parcialmente:**
- El anillo de foco visible (`:focus-visible` global) no se capturó en una captura de pantalla nítida al hacer Tab manualmente — confirmado por lectura de código (todos los controles nuevos son `<button>`/`<input>`/`<select>`/`<form>` nativos, sin ningún `<div onClick>`) y por el uso exitoso de teclado ya demostrado sobre los mismos componentes compartidos (`Pagination`) en esta tarea y en la anterior.
- No se probó el caso de decenas de miles de cuentas reales (obviamente, es un mock) — la afirmación de que "pedir la página 5 no reimpute" se verificó por lectura de código y diseño (cache por referencia), no cronometrando un dataset grande.

## [01/09/2026] — Correcciones de moneda y aging en Clientes Morosos (C1-C3)

### 1. Contexto
Tarea de corrección sobre la entrada anterior (`[01/09/2026] — Clientes morosos / deuda vencida`), encontrada antes de commitear nada de esa feature. Se leyó de nuevo `clients.service.ts`, `client.types.ts`, `clients.data.ts` y `ClientOverdueTable.tsx` completos para confirmar los tres problemas señalados antes de tocar código.

### 2. C1 — La imputación y el total por cliente ignoraban la moneda
**El bug, confirmado por lectura:** `imputeOpenInvoices` armaba un único pool numérico (`let pool = 0`) sumando `credit` de pagos y ajustes sin mirar `currency`, así que un pago en una moneda cancelaba facturas de cualquier otra. `computeOverdueSnapshot` sumaba `openBalance` de todas las facturas vencidas en un solo `overdueAmount` y le ponía la etiqueta `currency: oldest.currency` — sumaba montos de monedas distintas y rotulaba el resultado con la moneda de uno solo de ellos. No se manifestaba porque el mock era 100% ARS.

**Fix de la imputación:** el pool pasó a ser `Map<Currency, number>` (`poolByCurrency`); cada factura sólo consume del pool de su propia `currency`. El orden de aplicación (FIFO por `date` de emisión) no cambió — sigue siendo un único recorrido de facturas ordenadas por antigüedad, sólo que ahora cada una descuenta del pool que le corresponde.

**Fix del total: ¿una fila o dos por cliente que debe en dos monedas?** Se decidió **UNA fila por cliente**, con un nuevo campo `overdueByCurrency: OverdueAmountByCurrency[]` (`{ currency, amount }[]`) en `OverdueClientRow`, reemplazando a los campos sueltos `currency`/`overdueAmount`. Razón: en esta vista el cliente es la unidad de gestión de cobranzas — la búsqueda, la paginación y el filtro por tramo operan sobre clientes, no sobre pares cliente+moneda. Duplicar la fila habría roto la semántica de `totalItems` ("cantidad de clientes morosos") y habría hecho que un mismo cliente contara dos veces en la paginación. Lo que varía por moneda es el importe, no la identidad de la fila.

**¿El tramo más antiguo es por moneda o del cliente?** Se decidió que sea **del cliente**, sin importar en qué moneda está la factura que lo determina. Razón: la antigüedad se mide en días, no en dinero — comparar "¿hace cuántos días venció esto?" entre una factura en ARS y una en USD no mezcla magnitudes de plata (a diferencia de sumar los importes), así que no hay ningún problema de conversión ahí. Para cobranzas, además, la urgencia real de un cliente es "la deuda más vieja que tiene", sin importar en qué moneda está expresada. El mock (`cli-030`) fue diseñado a propósito para que la factura más vieja esté en USD (70 días, tramo 61-90) y la más nueva en ARS (40 días, tramo 31-60) — confirma que el tramo mostrado (`61-90 DIAS`) es el de la factura USD, no un promedio ni el de la moneda "principal".

**Los agregados por tramo (`AgingBucketAggregate`, `computeAggregates`) no se tocaron** — ya estaban agrupados correctamente por clave `bucket:currency` desde la tarea anterior; el bug estaba sólo en el pool de imputación y en `OverdueClientRow`. Se corrigió, además, el mismo error en la vista (`ClientOverdueTable.tsx`): el agrupador `bucketTotals` sumaba `agg.totalOverdue` de todas las monedas de un tramo en un solo número antes de mostrarlo — el mismo bug que en el servicio, sólo que en el cliente. Ahora cada tramo puede renderizar más de una línea (una por moneda con deuda en ese tramo), sin sumarlas. `formatCurrency` pasó a requerir el parámetro `currency` explícito (antes tenía `'ARS'` hardcodeado en el `Intl.NumberFormat`, otro síntoma del mismo problema de fondo).

**Mock:** se agregó `cli-030` ("Comercial Multimoneda SRL") con una factura en USD (1000, 70 días vencida) y una en ARS (50.000, 40 días vencida) más un pago de 20.000 ARS que sólo cubre la factura en ARS — sin este caso el fix no se puede probar (el mock anterior era 100% ARS). `Currency` pasó de `'ARS'` a `'ARS' | 'USD'`.

**Verificado en el navegador:** con "Clientes Morosos" sin filtrar, `Comercial Multimoneda SRL` muestra `US$ 1.000,00` y `$ 30.000,00` en dos líneas separadas, nunca sumadas ni convertidas; el tramo mostrado es `61-90 DIAS` (el de la factura USD); el resumen de tramos muestra `61-90 DIAS` con dos líneas: `$ 327.000,00 · 5 clientes` (ARS) y `US$ 1.000,00 · 1 cliente` (USD); buscando por el nombre o el CUIT del cliente, el resumen recalculado para ese único resultado muestra exactamente `31-60: $30.000,00 · 1 cliente` y `61-90: US$1.000,00 · 1 cliente`, confirmando que el pago en ARS no tocó la factura en USD.

### 3. C2 — El cache del snapshot no invalidaba por cambio de día
**El bug:** `getOverdueSnapshot` sólo comparaba la referencia de `clientsStore`; `computeOverdueSnapshot` usa `new Date()` para calcular días de mora y tramos. Una sesión que cruzara la medianoche sin que nadie editara un cliente seguía sirviendo el aging de ayer.

**Decisión:** se agregó una segunda condición de invalidación — el día calendario (`new Date().toDateString()`) con el que se calculó el snapshot cacheado, guardado junto a la referencia en `overdueSnapshotCache.computedOnDay`. `getOverdueSnapshot` recalcula si cambió la referencia de `clientsStore` **o** si cambió el día, lo que ocurra primero. Se descartó invalidar por timestamp exacto (cachear sólo unos minutos): el problema real no es "el cache es viejo por unos segundos" (eso no afecta el resultado, porque los tramos son de granularidad diaria) sino "cruzó la medianoche" — comparar el día calendario resuelve exactamente ese caso sin sacrificar el beneficio del cache dentro del mismo día (que sigue sirviendo cualquier cantidad de páginas sin reimputar, igual que antes).

**No verificado empíricamente en el navegador** (no se puede cruzar la medianoche real de una sesión de verificación de forma práctica) — verificado por lectura de código: `currentDayKey()` se llama en cada `getOverdueSnapshot()` y se compara contra el valor guardado; si un test mockeara `Date` para simular el cambio de día se podría verificar en runtime, pero no hay infraestructura de testing en este proyecto (fuera de alcance, R15) para hacerlo de forma automatizada. Queda documentado como verificación parcial, no como comprobado.

### 4. C3 — FIFO por fecha de emisión, no por vencimiento (documentado, sin cambiar)
`imputeOpenInvoices` ordena las facturas por `date` (emisión) antes de aplicar el pool, no por `dueDate` (vencimiento). Es una decisión de negocio que había quedado tomada por defecto en la tarea anterior, sin discutirse explícitamente — se documenta acá, sin cambiarla.

**Por qué da resultados distintos según el criterio:** si una factura A se emitió antes que B pero vence después (por ejemplo, un plazo de pago más largo negociado con ese cliente), imputar por emisión cancela A primero; imputar por vencimiento cancelaría B primero. El saldo abierto final de cada factura puede terminar siendo distinto según cuál de las dos se haya priorizado — no es un detalle de implementación intercambiable, es una regla de negocio real ("¿qué le cobro primero a un cliente, lo que le vendí primero o lo que se le vence primero?").

**Si el negocio pide el criterio alternativo:** es un cambio acotado a una línea en `imputeOpenInvoices` — cambiar `.sort((a, b) => a.date.localeCompare(b.date))` por `.sort((a, b) => a.dueDate.localeCompare(b.dueDate))` sobre las facturas antes de aplicar el pool. No requiere tocar el resto de la función, los tipos, ni el cache.

### 5. Verificación funcional realizada en el navegador
`npm run dev` (puerto 5174, el 5173 estaba ocupado por otro proceso ajeno a esta sesión) + Chrome real sobre `/clientes` (`C:\proyectos\SDGPD`). Confirmado, además de lo detallado en el punto 2: "Clientes Morosos" pasa de 21 a 22 clientes con el nuevo caso multimoneda incluido; los 4 tramos (ahora 5 líneas, una extra por USD en 61-90) no cambian entre página 1 (10 filas) y página 3 (últimas 2, parciales) con tamaño de página 10; filtro por tramo "61-90 días" corta a 5 filas (incluye a `Comercial Multimoneda SRL`, porque su tramo más antiguo es ese) sin tocar los totales de arriba; búsqueda por nombre y por CUIT del cliente nuevo devuelven el resultado correcto con los agregados recalculados sólo para ese cliente; búsqueda sin resultados muestra el mensaje de vacío con la paginación intacta (`Mostrando 0-0 de 0`); los casos ya verificados en la tarea anterior siguen dando el mismo resultado sin cambios: pago parcial ($40.000 en `cli-007` y `cli-016`), saldo a favor ausente (`cli-008`), ajuste de débito que no infla ($70.000 exactos en `cli-019`), multi-tramo con suma correcta (`cli-006`/`cli-015`/`cli-023`/`cli-027`); "Cuentas Corrientes" migrada muestra ahora 30 clientes (25+5, última página parcial) incluyendo al nuevo cliente, con badges y "Límite Excedido" intactos en los mismos clientes que antes; consola sin mensajes de error tras recargar (sólo logs de Vite/React DevTools). Servidor de desarrollo cerrado verificando PID (`10792`) y línea de comando (`vite.js` en `C:\proyectos\SDGPD\FrontEnd`) antes de matarlo, no por puerto solo.

**No verificado / verificado parcialmente:**
- C2 (cambio de día en el cache) — ver punto 3, verificado por lectura de código, no en runtime.
- Lo ya anotado como no verificado en la entrada anterior (foco visible en captura de pantalla, dataset de decenas de miles de cuentas) sigue en el mismo estado; esta tarea no agregó cobertura nueva sobre esos dos puntos.

## [01/09/2026] — Módulo Compras: OrdenDeCompra como entidad top-level (O1-O10)

### 1. Contexto
Última y más grande tarea de la secuencia: no crea nada desde cero, reconcilia tres piezas que ya existían sin hablarse entre sí — `TabPurchases` (inventory) con un botón "Generar OC" decorativo, `PurchaseOrderModal` (suppliers) que armaba líneas en memoria y las descartaba al guardar, y `SupplierPurchaseOrder` embebido en `Supplier.purchaseOrders[]` como snapshot manual sin líneas. Se leyeron completos antes de tocar nada: `modules/inventory/components/TabPurchases.tsx`, `modules/inventory/InventoryPage.tsx`, `shared/types/inventory.types.ts`, `data/mock/inventory.data.ts`; `modules/suppliers/SuppliersPage.tsx`, `modules/suppliers/components/{SupplierDetailPanel,PurchaseOrderModal,OrderItemsTable,OrderFinancialSummary}.tsx`, `shared/types/supplier.types.ts`, `services/mock/suppliers.service.ts`, `data/mock/suppliers.data.ts`; y como referencia de patrón vigente, `client.types.ts`/`clients.service.ts`/`ClientOverdueTable.tsx` (paginación + agregados por moneda) y `products.service.ts` (Map-join, store reasignado no mutado).

### 2. O1 — OrdenDeCompra top-level, no embebida en Supplier
Mismo antipatrón de escala ya corregido con `ProductStock` (E1, tarea de inventario multi-sucursal): con miles de proveedores y cientos de miles de órdenes, meter la colección grande (órdenes) dentro de la entidad chica (proveedor) obliga a recorrer todos los proveedores para responder "¿qué OC están pendientes esta semana?" — una consulta que Compras necesita resolver de forma barata y que Supplier no tiene por qué saber calcular.

Nuevo módulo `modules/compras/` (carpeta en **español**, a diferencia de `suppliers`/`orders`/`clients`/`inventory`/`logistics` que están en inglés — esto es una excepción **deliberada**, no un descuido: la tarea la pidió con ese nombre literal en O1 y, a diferencia de los demás módulos, el slug de ruta (`/compras`) coincide exacto con el nombre de carpeta, así que no hay traducción que hacer). Los TIPOS del dominio sí siguen la convención en inglés (`PurchaseOrder`, no `OrdenDeCompra`) porque 3.1 lo pide explícitamente ("nombres consistentes con el resto del proyecto, tipos en inglés") — es un split consciente entre el nombre de la carpeta (instruido) y el nombre de los tipos (convención del proyecto), documentado para que no se lea como inconsistencia accidental.

Ruta propia (`/compras`, `AppRoutes.tsx`) y entrada en `NAV_ITEMS` (`Sidebar.tsx`), entre Proveedores y Logística — es el módulo más relacionado con ambos (referencia a `Supplier` por ID, y el flujo de reposición nace en Inventario).

### 3. O2 — La OC tiene líneas; el total NUNCA se guarda suelto
`PurchaseOrder` (`shared/types/purchaseOrder.types.ts`) no tiene ningún campo `amount`/`total`. Tiene `lines: PurchaseOrderLine[]` (`{id, productId, quantity, unitPrice}`) y el total se calcula **siempre** con una única función pura, `computePurchaseOrderTotal(lines)` (`services/mock/purchaseOrders.service.ts`), llamada tanto para las filas del listado paginado como para el detalle de una orden como para los agregados por estado. No existe ningún lugar del código donde el total pueda quedar guardado y después desincronizarse de las líneas — el bug original (`{date, description, amount, status}` sin líneas) es estructuralmente imposible de reintroducir porque no hay dónde guardar un total suelto.

`productId` referencia `InventoryItem['id']` (el catálogo real de Inventario), **no** `SupplierProduct['id']` (el catálogo de precios propio de cada proveedor, que vive embebido en `Supplier.products[]`). Se evaluaron las dos opciones: `SupplierProduct` es la entidad que ya usaba el modal viejo para armar sus "sugerencias inteligentes", pero en el mock **no siempre comparte SKU con `InventoryItem`** (`sup-002`/`sup-003` tienen productos en su catálogo de precios sin equivalente real en `inventory.data.ts` — drift preexistente, no introducido por esta tarea). Además, O9 necesita poder crear una línea de OC a partir de una `PurchaseSuggestion` de Inventario, que solo conoce productos por su `InventoryItem['id']` — si las líneas referenciaran `SupplierProduct['id']`, O9 no tendría forma de construir una línea sin inventar una relación que no existe. `InventoryItem` es el único catálogo de productos verdaderamente compartido por los tres módulos que tocan esta tarea, así que es la referencia correcta (R2: ID tipado, nunca coincidencia de nombre/SKU).

Una sola moneda por orden (`PurchaseOrder.currency`), no por línea — distinto del criterio de clientes (`ClientTransaction.currency` por transacción, porque ahí las transacciones se acumulan en el tiempo y pueden mezclar moneda entre facturas históricas). Una orden de compra se emite de una sola vez a un proveedor: no hay ningún caso de negocio real donde una misma OC tenga líneas en ARS y en USD a la vez, así que modelarlo por orden es más simple y no pierde expresividad.

### 4. Qué se rompió al eliminar `SupplierPurchaseOrder` — lista completa del compilador (antes de arreglar nada)
Se eliminó `SupplierPurchaseOrder` y el campo `purchaseOrders: SupplierPurchaseOrder[]` de `Supplier` (`shared/types/supplier.types.ts`) en un solo paso, y se corrió `npx tsc -b --noEmit` para ver exactamente qué señalaba el compilador, sin tocar nada más todavía. Lista completa, tal como la reportó `tsc` (19 errores en 8 archivos):
- `data/mock/suppliers.data.ts` — 3 errores (`purchaseOrders` en los 3 proveedores del mock).
- `services/mock/suppliers.service.ts` — 4 errores (import de `SupplierPurchaseOrder`, `purchaseOrders: []` en `createSupplier`, y la función completa `addPurchaseOrder`, que usaba el tipo y el campo dos veces).
- `modules/suppliers/components/SupplierDetailPanel.tsx` — 6 errores (`supplier.purchaseOrders` y sus 5 campos accedidos en la tabla de "Historial y Deuda").
- `modules/suppliers/components/PurchaseOrderModal.tsx` — 1 error (import de `SupplierPurchaseOrder`) — este archivo se terminó eliminando por completo (migrado a Compras, ver punto 7).
- `modules/suppliers/SuppliersPage.tsx` — 1 error (mismo import) — `handleEmitPurchaseOrder` también se eliminó completo.
- Y, aparte de estos (errores propios introducidos por el nuevo código, no por la eliminación): 4 errores de `Currency` no exportado desde `purchaseOrder.types.ts` (`modules/compras/components/{PurchaseOrderDetailPanel,PurchaseOrdersTable,PurchaseOrderStatusSummary}.tsx` + `services/mock/purchaseOrders.service.ts`) — un `import type` sin `export type { Currency }` correspondiente en el mismo archivo; se corrigió agregando el re-export.

Cada archivo de la primera lista se corrigió migrando su lógica a Compras (ver puntos 5-7) en vez de solo silenciar el error de tipos — ninguno quedó con un `any` ni con una función vacía.

### 5. O3 — Compras es la única fuente de verdad
`Supplier` ya no tiene `purchaseOrders`. `SupplierDetailPanel.tsx` (tab "Historial y Deuda") se autoconsulta contra `services/mock/purchaseOrders.service#getPurchaseOrdersBySupplierId(supplier.id)` — no paginada a propósito (mismo criterio que `getStockedProductsForBranch` en `products.service.ts`, P8 de la tarea de paginación: es un panel de detalle de UN proveedor, con pocas órdenes, no un listado general). El estado de "cargando" se deriva comparando el proveedor ya cargado contra el actual (mismo patrón que `loadedStockBranchId` en `InventoryPage.tsx`), no un `setState(true)` sincrónico al arrancar el efecto — evita `react-hooks/set-state-in-effect` (encontrado y corregido durante esta tarea, ver punto 9).

Las etiquetas/variantes de badge de `PurchaseOrderStatus` (`draft`/`sent`/`received`/`cancelled`) se **duplican localmente** dentro de `SupplierDetailPanel.tsx` en vez de importarse desde `modules/compras/purchaseOrderLabels.ts` — R2 prohíbe que Suppliers importe archivos internos de Compras (ni siquiera un mapa de etiquetas, que no es lógica de negocio pero sigue siendo un archivo de otro módulo). Es el mismo tipo de duplicación consciente ya registrada en este documento para dashboard/analytics ("duplica el concepto de KPI/top-productos"), documentada en vez de cruzar el límite del módulo por una comodidad menor.

La columna "Descripción" que tenía la tabla vieja (`SupplierPurchaseOrder.description`, texto libre tipo "Pedido mensual aceites") se reemplazó por "Sucursal" (`branchesById.get(o.branchId)?.name`) — `PurchaseOrder` no tiene un campo de texto libre equivalente (a propósito, ver O2) y la sucursal de destino es información real y útil que antes no existía en esta vista.

### 6. O5 — Sucursal de destino: campo de la orden, no de la sesión
`PurchaseOrder.branchId` se fija al crear la orden (`activeBranchId` como *default* del formulario, nunca como filtro de la consulta). Verificado explícitamente en el navegador: se creó una OC en "Sucursal Centro", se cambió la sucursal activa del selector superior a "Sucursal Norte" (confirmado el cambio real vía `localStorage.getItem('sdgpd.activeBranchId')`, no solo visualmente — ver la nota del punto 9 sobre por qué se verificó así) y la orden ya creada siguió mostrando "Sucursal Centro" en el listado; al abrir "Nueva Orden de Compra" de nuevo, el campo "Sucursal de Destino" sí reflejó el nuevo default ("Sucursal Norte").

### 7. O4 — El modal se migra, no se duplica; vive en Compras, no en Suppliers
`PurchaseOrderModal.tsx` (+ `OrderItemsTable.tsx` + `OrderFinancialSummary.tsx`, sus dos subcomponentes) se **eliminaron** de `modules/suppliers/components/` — no quedó ningún archivo huérfano. El formulario se reconstruyó en `modules/compras/components/PurchaseOrderFormModal.tsx`, con react-hook-form + zod (`PurchaseOrderFormModal.schema.ts`, `useFieldArray` para las líneas — formulario real, no decorativo, cumpliendo R4) y estilos propios (`PurchaseOrderFormModal.css`, copiados y adaptados desde `SupplierModals.css` en vez de importarlos: el modal ya no vive en `suppliers`, así que no puede depender de que esa hoja de estilos esté cargada).

**Dónde vive, y por qué (la pregunta explícita de O4):** en `modules/compras/`, no en `modules/suppliers/`. Razón: el formulario llama a `createPurchaseOrder` (`services/mock/purchaseOrders.service.ts`), el punto de entrada público de Compras — eso es un import de servicio permitido entre módulos (mismo patrón ya establecido: `InventoryPage.tsx` ya importaba `fetchSuppliers` desde `services/mock/suppliers.service.ts` antes de esta tarea). Pero el **componente del modal en sí** no puede vivir en `suppliers` si `suppliers` lo va a importar — importar un componente de otro módulo (a diferencia de importar su servicio) sí es "internals" en el sentido de R2, y no hay ningún precedente en el proyecto de un módulo importando un componente de otro. Dado que `OrdenDeCompra` es conceptualmente de Compras (O1), el componente que la crea pertenece ahí.

**Cómo se dispara desde Suppliers sin importar el componente:** `SuppliersPage.tsx` y `SupplierDetailPanel.tsx` ya no abren un modal local — `handleNewOrder`/`handleNewOrderForSelectedSupplier` llaman a `navigate('/compras')` / `navigate('/compras?proveedor=<id>')` (react-router, `useNavigate`). `ComprasPage.tsx` lee `?proveedor=` en un efecto al montar, guarda el valor en estado propio (`supplierIdFromUrl`) **antes** de limpiar el query param (ver el bug de timing del punto 9), abre el modal con ese proveedor preseleccionado, y borra el query param de la URL para que un refresh no reabra el modal solo. Es deep-linking puro por URL — cero import cruzado de componentes en ninguna dirección, la forma más estricta de cumplir R2 que se evaluó.

El link decorativo "Ver histórico de compras a este proveedor" (`<a>` sin `href` ni `onClick`, ya presente en el modal viejo) se eliminó al migrar: ahora el modal vive dentro de Compras, que **es** ese histórico (el listado de la izquierda de la misma pantalla), así que el enlace había perdido su razón de ser.

**Segundo ejemplo del mismo patrón — "Generar OC" desde stock crítico (02/09/2026, Task A):** `TabLowStock.tsx` (`modules/inventory/components/`) necesitaba abrir este mismo modal con una línea completa precargada (producto + cantidad sugerida + proveedor) al hacer click en "Generar OC" sobre un producto en déficit. Se evaluó extender `PurchaseOrderFormModal` con una prop y abrirlo directo desde `TabLowStock` — se descartó de inmediato por ser exactamente el cruce de módulos que este mismo punto de O4 ya prohibió para el caso de Suppliers (`inventory` importando un componente de `compras`). Se aplicó el mecanismo ya establecido en su lugar: `TabLowStock` navega a `/compras?producto=<productId>&sucursal=<branchId>` (mismo estilo de query param en español que `?proveedor=`, sin mezclar convenciones); `ComprasPage.tsx` extiende el mismo efecto que ya leía `?proveedor=` para también leer `producto`/`sucursal`, resuelve el `Supplier['id']` real vía `InventoryItem.supplierId` (el catálogo, `products`, ya estaba cargado en Compras por O4 — no hizo falta pedir nada nuevo) y arma la línea precargada (`defaultLines`, prop nueva de `PurchaseOrderFormModal`, `PurchaseOrderLine` sin `id`) antes de abrir el modal. Sigue habiendo cero import cruzado de componentes.

Diferencia con el caso de Suppliers: acá el efecto debe esperar a que `products` esté cargado (mismo guard de "reintentar hasta que exista" que ya usa el modal internamente con `suppliers` para el `<select>`, punto 4 más abajo) antes de poder resolver el producto — si el efecto corriera con `products` todavía vacío, el deep-link se perdería en silencio igual que se perdería un `<select>` sin la opción cargada.

**Cantidad sugerida — de dónde sale y por qué se recalcula en destino:** la cantidad (`minStock - stock`, nunca negativa) se vuelve a pedir en `ComprasPage` vía `getStockForBranch(productId, branchId)` (`services/mock/products.service.ts`, ya público) en vez de viajar ya calculada en un tercer query param. Se evaluó pasarla en la URL (`&cantidad=<n>`) pero se descartó: `getStockForBranch` ya es una función de servicio pública (mismo tipo de import ya permitido, no un componente), evita duplicar la fórmula del déficit en dos módulos, y recalcula sobre el stock vigente en vez de confiar en un número que pudo quedar desactualizado entre que se listó el bajo stock en Inventario y el click en "Generar OC". Si el producto no tiene registro de stock en esa sucursal (o el déficit recalculado da 0 — no debería pasar, ver el criterio de habilitación del botón más abajo, pero es una red de seguridad) la línea arranca con cantidad `1` en vez de `0`, porque el schema de líneas exige mínimo 1 y el usuario la edita de todas formas antes de confirmar.

**Criterio de habilitación del botón en `TabLowStock`:** el déficit (`minStock - stock`) en este tab siempre es `>= 0` (E6: el filtro ya es `stock <= minStock`), pero puede ser exactamente `0` cuando `stock === minStock`. En ese caso el botón "Generar OC" se **deshabilita** (`disabled`, con `title`/`aria-label` explicando el motivo) en vez de ocultarse — se eligió deshabilitar para que la columna Acciones no salte de layout entre filas (misma fila siempre muestra ambas acciones) y para que quede visualmente claro que la acción existe pero no aplica, en vez de que el usuario se pregunte por qué falta.

### 8. O6 — Moneda sin conversión
`PurchaseOrderFormModal` tenía ya un `useState<'ARS'|'USD'>('ARS')` que nunca se persistía (se descartaba junto con todo lo demás al guardar `{date,description,amount,status}`). Ahora `currency` es un campo real del formulario (`register('currency')`, validado por el schema con `z.enum(['ARS','USD'])`) y viaja en `CreatePurchaseOrderInput.currency` hasta `PurchaseOrder.currency`. Sin cotización ni conversión (fuera de alcance, igual que en clientes) — `Currency` se reusa desde `client.types.ts` en vez de duplicarse (mismo patrón que `Branch`/`Supplier` ya importados en `inventory.types.ts`: un tipo de `shared/types/` puede ser consumido por otro archivo de `shared/types/`, no es "importar internals de un módulo" porque `shared/types/` no es de ningún módulo).

### 9. O7 — Estados y transiciones válidas; bug de timing encontrado y corregido en el camino
`PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled'`. Tabla de transiciones, única fuente de verdad en el servicio (`VALID_TRANSITIONS`, `purchaseOrders.service.ts`):
```
draft:     ['sent', 'cancelled']
sent:      ['received', 'cancelled']
received:  []
cancelled: []
```
`updatePurchaseOrderStatus(orderId, nextStatus)` devuelve `{success, order?, reason?}` (`reason: 'invalid-transition' | 'order-not-found'`), sin excepciones ni texto de UI — mismo contrato que `useSessionStore#setActiveBranch`/`useReplenishmentStore#requestReplenishment`. La UI (`PurchaseOrderDetailPanel.tsx`) solo renderiza los botones de las transiciones válidas para el estado actual (nunca expone un botón que vaya a fallar), así que el camino de "transición inválida" se probó invocando el servicio directamente desde la consola del navegador (`import()` dinámico del módulo + llamada manual), no clickeando un botón que no existe — ver punto 11.

`createPurchaseOrder` acepta `status?: 'draft' | 'sent'` (nunca `'received'`/`'cancelled'` al crear: esos solo se llegan por transición). El formulario usa esto para diferenciar sus dos botones ya existentes en el prototipo viejo — "Guardar Borrador" → `status: 'draft'`, "Emitir Orden de Compra" → `status: 'sent'` — en vez de que ambos crearan siempre en `'draft'`, que hubiera sido ignorar la distinción que el propio formulario ya proponía.

**Bug real encontrado y corregido durante la verificación (no en el diseño, en la implementación):** el efecto de `PurchaseOrderFormModal` que aplica `defaultSupplierId` al abrir (`reset(purchaseOrderFormDefaultValues(...))`) corría antes de que `suppliers` (cargado async por `ComprasPage` vía `fetchSuppliers`, ~400ms) incluyera al proveedor pedido — un `<select>` nativo ignora en silencio un `value` que no coincide con ningún `<option>` todavía renderizado, así que el proveedor preseleccionado por el deep-link de Suppliers se perdía. Se encontró probando el flujo real (Proveedores → "Nueva OC" → el select mostraba "Seleccionar proveedor..." en vez de "Las Marías S.A.C.I."), no por inspección de código. Fix: un `useRef` (`appliedDefaultsRef`) que reintenta el `reset()` en cada cambio de `suppliers` hasta que el proveedor pedido exista en la lista, y no vuelve a resetear una vez aplicado (para no borrar lo que el usuario ya cargó si `suppliers` se refresca después). Verificado de nuevo tras el fix: el proveedor aparece preseleccionado correctamente.

**Segundo hallazgo de la misma sesión de verificación (mismo bug, distinto síntoma):** dos selectores de zustand nuevos (`useSessionStore((s) => s.session?.branches ?? [])`, en `ComprasPage.tsx` y `SupplierDetailPanel.tsx`) causaban `"The result of getSnapshot should be cached"` seguido de `"Maximum update depth exceeded"` — el `?? []` crea un array nuevo en cada render mientras `session` es `null` (sesión todavía cargando), y `useSyncExternalStore` (con el que zustand implementa `useSessionStore`) entra en loop si el snapshot "cambia" en cada llamada aunque el contenido sea equivalente. Fix: una constante `EMPTY_BRANCHES: Branch[] = []` a nivel de módulo en ambos archivos, reusada en el fallback (`?? EMPTY_BRANCHES`) en vez de crear el array inline — mismo problema que `InventoryPage.tsx` evita por otro camino (selecciona el objeto `session` completo una sola vez y deriva `branches` fuera del selector, en JS plano).

### 10. O8 — Listado paginado, agregados por estado y por moneda
`getPurchaseOrdersPage` sigue el contrato completo (`PageQuery`/`PageResult`, `usePagedQuery`, `Pagination`, `FetchingOverlay`). Filtros tipados: `search` (matchea contra el **id de la propia orden**, no contra el nombre del proveedor — el servicio de Compras no conoce nombres de proveedor, solo `supplierId`, y buscarlo por nombre hubiera requerido importar `suppliers.service` dentro de `purchaseOrders.service`, cruzando el límite de módulo por una conveniencia de búsqueda; el filtro por proveedor existe aparte, como select de ID exacto poblado por la vista con `fetchSuppliers()`), `supplierId`, `status`, `branchId`.

Agregados (`PurchaseOrdersAggregates.byStatus`, clave compuesta `status:currency`, mismo patrón que `AgingBucketAggregate` de clientes) se calculan sobre el scope de búsqueda/proveedor/sucursal **sin** aplicar el filtro de estado — mismo criterio que el tramo en Clientes Morosos y el estado en Logística: el estado es la faceta que el usuario togglea, no debe cambiar los totales de las otras facetas. Verificado en el navegador: filtrar por proveedor SÍ recalcula los agregados (acota el universo, como `search`); filtrar por estado NO los cambia (sigue mostrando los 4 estados con sus totales completos, incluso con "Borrador" seleccionado).

Orden determinístico con desempate estable por `id` (`compareOrders` + `a.id.localeCompare(b.id)`), mismo patrón que el resto del proyecto. Índices con `Map` donde hay joins: la vista (`ComprasPage.tsx`) arma `suppliersById`/`branchesById`/`productsById` una sola vez con `useMemo`, y las tablas (`PurchaseOrdersTable`, `PurchaseOrderDetailPanel`) los consumen sin `find()` dentro de `map()`. El servicio en sí (`purchaseOrders.service.ts`) no tiene joins entre colecciones separadas — cada `PurchaseOrder` ya trae sus propias `lines` anidadas, mismo caso que `clients.service.ts` (sin `find()` dentro de `map()` porque no aplica).

### 11. O9/O10 — Generar OC desde stock crítico: resolución de proveedor y criterio de agrupación
**O9, resolución del proveedor:** `PurchaseSuggestion` (`shared/types/inventory.types.ts`) gana un campo `productId: InventoryItem['id']` (antes solo tenía `sku`/`supplierName`, ambos texto libre sin garantía de referenciar nada real). `TabPurchases.tsx` resuelve el proveedor real en dos pasos, ambos client-side, antes de llamar a ningún servicio: `products.find(p => p.id === suggestion.productId)` → si no existe, error y corta ahí; `suppliers.find(s => s.id === product.supplierId)` → si no existe, error y corta ahí. Nunca se usa `suggestion.supplierName` para resolver nada — ese campo queda solo para la columna "Proveedor" de la tabla (exhibición).

**Producto sin proveedor válido (el caso explícito de O9):** se decidió rechazar sin crear nada, con un toast de error claro (`"${producto}" no tiene un proveedor valido asociado. Asigna un proveedor real desde Productos antes de generar la OC.`) y sin llamar al servicio de Compras en absoluto — no se generó una OC "huérfana" ni con un `supplierId` inventado. Se agregó un caso de borde real al mock para poder probarlo: `inv-019` ("Producto Descontinuado 500g") con `supplierId: 'sup-999'`, que no existe en `suppliers.data.ts`, más `sug-004` en `inventory.data.ts` referenciándolo. Verificado en el navegador: clic en "Generar OC" para ese producto muestra el error y no aparece ninguna orden nueva en Compras.

**O10, criterio de agrupación (decidido explícitamente, no dejado por accidente):** si ya existe una OC en estado `'draft'` para el mismo `supplierId` + `branchId`, la línea se agrega ahí — sumando la cantidad a la línea existente si el producto ya estaba en esa orden, o agregando una línea nueva si no — en vez de crear una orden separada. Razón: en la vida real no se le mandan cinco órdenes de compra distintas al mismo proveedor para la misma entrega; se junta todo en una. El criterio deja de aplicar en cuanto esa orden deja de ser `'draft'` (se envía/recibe/cancela) — el próximo "Generar OC" para ese proveedor+sucursal crea una nueva, no reabre ni reusa una orden ya en curso. Implementado en `generatePurchaseOrderFromSuggestion` (`purchaseOrders.service.ts`), función dedicada y distinta de `createPurchaseOrder` (tiene lógica de merge que la alta manual no necesita), que devuelve `{success, order, merged, reason?}` — `merged: true` cuando se agregó a una orden existente, para que la vista pueda dar un mensaje distinto ("Se agregó X a la orden Y" vs "Se creó la orden Y").

Verificado en el navegador con el máximo nivel de detalle posible: "Generar OC" para Yerba Mate (proveedor Las Marías, Sucursal Centro, cantidad sugerida 300) creó `po-...` en `draft` con una línea de 300 unidades; clic de nuevo sobre la misma sugerencia agregó la línea a la **misma** orden (mensaje "Se agregó... a la orden... borrador existente"), y al abrir el detalle la línea mostraba **una sola fila**, cantidad **600** (300+300, no dos filas de 300 cada una) — confirma que el merge suma cantidad en la línea existente, no solo evita duplicar la orden.

### 12. Verificación funcional realizada en el navegador
`npm run dev` (puerto 5174) + Chrome real sobre `C:\proyectos\SDGPD`. Además de lo detallado en los puntos anteriores: la ruta `/compras` carga y aparece en el sidebar entre Proveedores y Logística; paginación (tamaño 25→10, salto a la última página, 34→3 filas parciales) y agregados idénticos entre página 1 y la última; filtro por proveedor (11 resultados, agregados recalculados solo para ese proveedor), por estado (9 en "Borrador", agregados sin cambiar), por sucursal, y combinados (proveedor+sucursal → 1 resultado exacto), todos vuelven a página 1; búsqueda por número de OC devuelve el resultado correcto (`po-005`, el caso de borde de producto fuera de catálogo); detalle de una orden con una sola línea (`po-001`, $300.000) y con producto fuera de catálogo (`po-005`: una línea real + "Producto no disponible" para `inv-999`, sin `undefined` ni pantalla rota, total $108.800 = suma exacta de ambas líneas); transición válida (`draft`→`sent` en `po-001`, refleja el nuevo estado y actualiza el resumen sin recargar) e inválida (`received`→`draft` en `po-004`, `{success:false, reason:'invalid-transition'}`, verificado por consola ya que la UI no expone un botón para dispararla — ver punto 9) y `order-not-found` sobre un id inexistente; consola sin errores nuevos tras una recarga limpia (solo logs de Vite/HMR/React DevTools, confirmado con `read_console_messages` + `clear` para descartar mensajes viejos de antes de los dos fixes del punto 9).

**No verificado / verificado parcialmente:**
- Búsqueda debounced (M6/O8): se confirmó el resultado final correcto (tipear rápido "po-005" resolvió al único resultado esperado), pero no se re-instrumentó `useDebouncedValue` con `console.log` en esta tarea — es el mismo hook, sin cambios, ya verificado rigurosamente con esa instrumentación en la tarea anterior (Clientes Morosos, `[01/09/2026] — Clientes morosos`, punto 8). No repetirlo fue una decisión deliberada de no rehacer una verificación ya hecha sobre código idéntico, no un olvido.
- El foco visible en captura de pantalla y el comportamiento con decenas de miles de órdenes reales siguen sin medirse, en la misma línea que las entradas anteriores de este documento.
- Los toasts de sonner con `action` (usados por primera vez en esta tarea) permanecieron visibles en pantalla más tiempo del esperado durante la sesión de pruebas, tapando visualmente algunos botones y obligando a interactuar con ellos vía `document.querySelector(...).click()` en vez de un click de mouse simulado en un par de pasos — no se investigó si es un comportamiento normal de sonner con `action` (duración más larga por defecto) o un efecto de la herramienta de automatización; no bloqueó ninguna verificación, solo el método usado para hacer clic.

### 13. O11 — Alcance: qué se rozó y no se tocó
Los filtros que perdió Cuentas Corrientes (zona/vendedor/estado, tarea de Clientes Morosos), el `await` del escaneo de código de barras en `OrderProductsSection`, y la migración de otros módulos al contrato paginado: no se tocó ninguno. `Supplier.pendingOrdersCount`/`daysUntilExpiration`/`currentBalance`/`hasOverdueDebt` (campos legacy de cuentas por pagar, no derivados de `purchaseOrders` en código) tampoco se tocaron — siguen siendo valores curados a mano en el mock, deuda técnica ya conocida y separada de esta tarea.

## [02/09/2026] — Regla de selectores estables en zustand (corrección de raíz)

### 1. Contexto
Durante la tarea de Compras (`[01/09/2026] — Módulo Compras`) aparecieron dos selectores escritos así: `useSessionStore((s) => s.session?.branches ?? [])`. El `?? []` crea un array **nuevo** en cada render mientras `session` es `null` (la sesión carga async). `zustand` usa `useSyncExternalStore` por debajo, que compara el snapshot devuelto por el selector **por referencia**: si "cambia" en cada llamada aunque el contenido sea equivalente, entra en loop de renders. Síntoma exacto en consola: `"The result of getSnapshot should be cached to avoid an infinite loop"` seguido de `"Maximum update depth exceeded"`, con la pantalla rota. Se corrigió puntualmente en su momento con una constante `EMPTY_BRANCHES` a nivel de módulo en `ComprasPage.tsx` y `SupplierDetailPanel.tsx`. `InventoryPage.tsx` no tenía el bug, pero por otro camino distinto (seleccionaba `session` entero y derivaba `branches` afuera del selector). Tres formas distintas de tratar el mismo problema, dos correctas por accidente, ninguna escrita como norma. Esta tarea convierte el fix puntual en regla, auditando **todos** los selectores de zustand del proyecto (no solo los tres conocidos), no agrega features.

### 2. Auditoría completa — todos los stores y todos los selectores del proyecto
El proyecto tiene exactamente **dos** stores reales de `zustand`: `useSessionStore` (`shared/state/`) y `useReplenishmentStore` (`modules/inventory/state/`). `useDeliveriesStore`, mencionado en comentarios como "el primer store real", ya no existe como archivo — logistics hoy solo lee `activeBranchId` de `useSessionStore`. Se relevaron los 15 call-sites de selector en 9 componentes (`grep` de `useSessionStore(`/`useReplenishmentStore(` en todo `src/`):

| Archivo | Selector | Clasificación |
|---|---|---|
| `AppShell.tsx` | `(s) => s.loadSession` | Seguro — función del store, referencia estable |
| `BranchSelector.tsx` | `(s) => s.session` | Seguro — referencia del store tal cual |
| `BranchSelector.tsx` | `(s) => s.activeBranchId` | Seguro — primitivo |
| `BranchSelector.tsx` | `(s) => s.isLoading` | Seguro — primitivo |
| `BranchSelector.tsx` | `(s) => s.setActiveBranch` | Seguro — función del store |
| `InventoryPage.tsx` | `(s) => s.session` | Seguro — referencia del store tal cual; `branches` se deriva **afuera** del selector (`session?.branches.find(...)`) |
| `InventoryPage.tsx` | `(s) => s.activeBranchId` | Seguro — primitivo |
| `StockAdjustmentModal.tsx` | `(s) => s.activeBranchId` | Seguro — primitivo |
| `LogisticsPage.tsx` | `(s) => s.activeBranchId` | Seguro — primitivo |
| `OrderProductsSection.tsx` | `(s) => s.activeBranchId` | Seguro — primitivo |
| `TabLowStock.tsx` | `(s) => s.statusByProductId` | Seguro — `Record` que vive en el store, reemplazado solo cuando cambia de verdad (`requestReplenishment`), no reconstruido en cada lectura |
| `TabLowStock.tsx` | `(s) => s.requestReplenishment` | Seguro — función del store |
| `ComprasPage.tsx` | `(s) => s.session?.branches ?? EMPTY_BRANCHES` | **Roto, corregido en esta tarea** — construcción condicional dentro del selector (dependía de recordar la constante) |
| `SupplierDetailPanel.tsx` | `(s) => s.session?.branches ?? EMPTY_BRANCHES` | **Roto, corregido en esta tarea** — mismo caso |

No se encontró ningún selector con `.map`/`.filter`/spread/objeto-literal dentro del callback (los dos únicos casos problemáticos eran el `?? []`/`?? EMPTY_BRANCHES`). No se encontraron otros stores ni otros hooks `use*Store` en el proyecto.

### 3. La regla (Z2) — selectores solo leen, la derivación va afuera
**Regla única para todo el proyecto:** un selector de `zustand` (`use*Store((s) => ...)`) solo puede devolver una referencia que **ya vive en el store** — el store completo, un slice/objeto tal cual, un primitivo, o una función de acción — nunca puede construir un valor nuevo (`?? []`, `?? {}`, `.map`/`.filter`/`.slice`/spread, objeto/array literal). Toda derivación (defaults para "todavía no cargó", listas mapeadas, objetos armados) se hace **después** del hook, en el cuerpo del componente, memoizada con `useMemo` si alimenta a otro `useMemo`/dependencia de efecto.

Ejemplo, el patrón a seguir en cualquier selector nuevo:
```ts
const session = useSessionStore((s) => s.session); // selector: solo lee
const branches = session?.branches ?? EMPTY_BRANCHES; // derivación: afuera del selector
```

**Por qué esta y no la constante `EMPTY_BRANCHES` dentro del selector** (la otra opción que ya existía en el código, en los dos archivos que tenían el bug): el criterio de decisión pedido es cuál es más difícil de olvidar para alguien que escribe un selector nuevo dentro de seis meses, no cuál es más elegante.
- Con `EMPTY_BRANCHES` **dentro** del selector, cada desarrollador tiene que acordarse de dos cosas a la vez: que necesita un default, y que ese default tiene que ser una constante a nivel de módulo (no un literal inline) — exactamente el paso que se olvidó la primera vez, dos veces, en dos archivos distintos. El error solo se manifiesta cuando `session` es `null`, es decir en la ventana de carga inicial async — intermitente, fácil de no notar en desarrollo si no se recarga la página en el momento exacto.
- Con la regla "el selector solo lee, la derivación va afuera", un `?? []` inline en el cuerpo del componente (fuera del selector) **no rompe nada**: es una variable de render común, no el valor devuelto a `useSyncExternalStore`, así que una referencia nueva en cada render ahí es inofensiva en términos de loop. El único costo de olvidarse de memoizar es que un `useMemo` río abajo (como `branchesById` en `ComprasPage`/`SupplierDetailPanel`) se recalcula de más — una degradación de performance menor, nunca una pantalla rota. Se mantuvo `EMPTY_BRANCHES` en esos dos archivos, pero movida afuera del selector, específicamente para que ese `useMemo` no se invalide en cada render — no para evitar el loop (que ya no puede pasar ahí).
- Esta regla también es la única de las dos que cubre **todos** los casos del enunciado (arrays, objetos, y el resultado de un `.map`/`.filter`), no solo el de "necesito un array vacío por default". Una constante nueva por cada caso no escala; "derivar afuera del selector" es una sola idea, válida siempre.
- No hubo ningún caso en la auditoría (punto 2) que necesitara un tratamiento distinto — los 15 selectores existentes ya encajan en la regla sin excepciones.

`InventoryPage.tsx` ya seguía este patrón antes de esta tarea (sin saberlo formalmente); ahora es la referencia documentada, y `ComprasPage.tsx`/`SupplierDetailPanel.tsx` se alinearon a él.

### 4. Salvaguarda de ESLint (Z4)
El proyecto no tiene (ni tenía) ningún plugin de ESLint específico de `zustand`, y no se instaló ninguno (fuera de alcance — regla explícita de la tarea). Sí existe, ya disponible sin dependencias nuevas porque es una regla **core** de ESLint (`eslint.config.js` ya carga `js.configs.recommended`), `no-restricted-syntax`, que permite matchear patrones de AST arbitrarios con selectores estilo CSS/esquery. Se agregaron tres entradas a `no-restricted-syntax` en `eslint.config.js`, en warning (mismo nivel que el resto de las reglas custom del archivo — `no-restricted-imports`, `naming-convention`), que detectan dentro de cualquier `use*Store((s) => ...)`:
- un `ArrayExpression` (`[...]` o el lado derecho de un `?? []`),
- un `ObjectExpression` (`{...}` o el lado derecho de un `?? {}`),
- una llamada a `.map`/`.filter`/`.slice`/`.concat`/`.sort`/`.reduce`/`.flatMap`.

Se probó manualmente con un archivo temporal (borrado después de verificar, no forma parte del proyecto) reproduciendo los tres patrones — los tres se detectaron correctamente y con el `line:column` exacto. No cubre el caso de un `??` con default primitivo (`s.count ?? 0`), que es intencional: ese caso es seguro (los primitivos no rompen la comparación por referencia) y no debía marcarse. Distinguir "default de array/objeto" de "default de primitivo" con precisión total requeriría lint con información de tipos (`typescript-eslint` en modo `recommendedTypeChecked`, con `parserOptions.project`), que hoy no está habilitado y agregarlo excede el alcance de esta tarea (no es una dependencia nueva, pero sí un cambio de configuración más invasivo que el pedido). Quedó en warning, no en error, porque el matcheo es heurístico por AST (nombre de función terminado en `Store`) y podría marcar algún falso positivo si en el futuro se agrega un `use*Store` que no sea de `zustand`.

### 5. Cambios
- `src/modules/compras/ComprasPage.tsx` y `src/modules/suppliers/components/SupplierDetailPanel.tsx`: selector `(s) => s.session?.branches ?? EMPTY_BRANCHES` reemplazado por `(s) => s.session` + `const branches = session?.branches ?? EMPTY_BRANCHES;` afuera del selector. `EMPTY_BRANCHES` se mantiene (sigue siendo necesaria para no invalidar el `useMemo` de `branchesById`), pero ya no participa del valor devuelto al selector.
- `eslint.config.js`: tres entradas nuevas en `no-restricted-syntax` (punto 4).
- Ningún otro selector de los 15 relevados necesitó cambios — ya cumplían la regla.

### 6. Alcance — qué no se tocó
No se tocaron los pendientes abiertos de otras tareas (filtros de Cuentas Corrientes, escaneo de código de barras, módulos sin paginar, nombre de la carpeta `compras`) ni se agregó ninguna feature. Solo selectores de `zustand` y la norma que los rige.

## [02/09/2026] — "Generar OC" desde stock crítico y tab "Pendientes de Recepción" en Compras

### 1. Contexto
Dos tareas sobre el mismo dominio compras/stock: (A) botón "Generar OC" en `TabLowStock` (inventory) que precarga una orden de compra editable; (B) tab nuevo en `ComprasPage` que lista solo `PurchaseOrder` en estado `sent` de la sucursal activa, con acción para marcarlas como recibidas. El mecanismo de deep-link de Task A (query params + resolución en `ComprasPage`, sin import cruzado de componentes) queda documentado como segundo ejemplo dentro de O4, más arriba en este archivo — acá solo las decisiones que no encajaban ahí.

### 2. Tabs en `ComprasPage` — se reutilizó `Tabs` compartido, sin infraestructura nueva
`ComprasPage` no tenía tabs (a diferencia de `InventoryPage`, que ya usa `shared/components/ui/Tabs.tsx` para 9 pestañas, incluida `TabLowStock`). Se aplicó el mismo componente compartido: `activeTab`/`setActiveTab` en `ComprasPage`, dos `TabItem`: `listado` (el contenido que ya existía — resumen, filtros, tabla, paginación — sin ningún cambio de comportamiento) y `pending-receipt` (`TabPendingReceipt`, componente nuevo en `modules/compras/components/`). Cero componente de infraestructura nuevo: `Tabs` ya soportaba este caso.

### 3. `TabPendingReceipt` — auto-filtro por sucursal activa, distinto a propósito del filtro manual del listado general
El listado general de `ComprasPage` filtra sucursal de forma **manual** (`branchFilter`, un `<select>` independiente — `activeBranchId` es solo el *default* al crear una orden, no un filtro de la consulta; ver O5 más arriba: una OC ya creada sigue mostrando su sucursal aunque el usuario cambie de sucursal activa después). `TabPendingReceipt` usa el criterio opuesto **a propósito**: recibe `branchId: Branch['id']` como prop obligatoria (igual patrón que `TabLowStock` recibe de `InventoryPage` — no un selector propio) y `ComprasPage` se la pasa directo desde `activeBranchId`, mismo criterio que `LogisticsPage`. La diferencia de negocio entre ambos casos: el listado general es un histórico (tiene sentido ver una OC vieja de otra sucursal), mientras que "pendientes de recepción" es una lista de tareas operativas de HOY en LA sucursal donde estoy parado — no tiene sentido gestionar la recepción de una orden de otra sucursal desde acá. Ambos patrones conviven en el mismo archivo (`ComprasPage.tsx`) sin tocarse entre sí.

Filtro pasado a `getPurchaseOrdersPage` (ya existente, no se duplicó el service): `{ status: 'sent', branchId }`, memoizado con `useMemo`. Sin `enabled` explícito en `usePagedQuery` — a diferencia de `LogisticsPage` (que renderiza siempre y gatea internamente), acá el gate de "todavía no hay sucursal activa" ya lo hace `ComprasPage` afuera (`!activeBranchId ? <SkeletonTable/> : <TabPendingReceipt branchId={activeBranchId} .../>`, mismo criterio que ya usaba para `TabLowStock` en `InventoryPage`), así que `TabPendingReceipt` nunca monta con un `branchId` inválido.

### 4. "Marcar como Recibida" — se reutilizó `PurchaseOrderDetailPanel` tal cual, `PurchaseOrdersTable` NO se tocó
Se investigó extender `PurchaseOrdersTable` con una prop no invasiva (`renderExtraAction`) antes de escribir código, pero resultó innecesario: `PurchaseOrderDetailPanel` (el panel que ya abre "Ver detalle") **ya** renderiza el botón "Marcar como Recibida" para cualquier orden en estado `sent` (transición `sent -> received`, ver O7) — es el mismo panel, sin modificar, que usa el listado general. `TabPendingReceipt` simplemente abre ese panel con su propio estado local (`selectedOrder`/`isDetailOpen`/`isTransitioning`) y su propio `handleTransition`, que llama a `updatePurchaseOrderStatus` (ya existente, sin cambios de firma) y hace `refetch()` de **su propia** página (no la del listado general) al confirmar — la orden deja de matchear `status: 'sent'` y desaparece de la lista sin recargar la pantalla completa (P10: refetch de la página vigente, no actualización optimista en el cliente). El panel se cierra automáticamente al confirmar la transición (evita mostrar una orden ya `received`/`cancelled` cuya fila ya desapareció de la tabla de abajo).

Efecto colateral aceptado, no buscado: como se reutiliza el panel completo sin forkearlo, "Cancelar Orden" (la otra transición válida desde `sent`) también queda disponible desde este tab. No se restringió porque hacerlo hubiera requerido forkear o parametrizar `PurchaseOrderDetailPanel` solo para ocultar una acción que de todas formas es coherente con la pantalla (una orden que nunca va a llegar también se resuelve gestionándola desde "pendientes de recepción").

### 5. `RUTAS_Y_MODULOS.md` — no se tocó
Esa doc registra únicamente rutas nuevas (`<Route path="..."`), no tabs dentro de una ruta existente — ninguna de las 9 tabs de `InventoryPage` (incluida `TabLowStock`) está registrada ahí tampoco. Esta tarea no agrega ninguna ruta nueva (`/compras` ya existía), solo un tab dentro de ella, así que no aplica.

### 6. Verificación — limitación de esta sesión
`tsc -b` y `npm run lint` corren limpios (0 errores; el único warning es preexistente, no introducido por esta tarea — ver `PurchaseOrderFormModal.tsx`, `watch()` de react-hook-form). El servidor de dev arrancó sin errores y los 4 módulos tocados/nuevos transformaron correctamente en Vite. **No se pudo completar la verificación funcional real en navegador** (clicks, flujo end-to-end, caso de déficit 0, refetch tras "Marcar como Recibida"): la extensión Claude en Chrome no estaba conectada en esta sesión (job en background). Queda pendiente de verificación manual antes de considerar la tarea cerrada.

## [03/09/2026] — Rango de fecha, Sucursal/Depósito y Exportar (tarea transversal, 6 listados)

### 1. Contexto
Tres features transversales aplicadas a los 6 listados ya migrados a `usePagedQuery` (ComprasPage listado general, `TabPendingReceipt`, `TabLowStock`, `LogisticsPage`, `ClientAccountsTable`, `ClientOverdueTable`): (A) selector de rango de fecha, (B) selector de sucursal/depósito, (C) botón Exportar Excel/CSV. Los módulos sin migrar (suppliers, orders, cash, dashboard, analytics, settings, resto de tabs de inventory, directorio de clientes) quedan explícitamente fuera de alcance — no se tocó ninguno.

### 2. Tarea A — `DateRangeFilter` (`shared/components/ui/`)
Componente nuevo (`DateRangeFilter.tsx` + `dateRangePresets.ts`, separados por `react-refresh/only-export-components` — mismo criterio que `agingLabels.ts`/`deliveryStatusLabels.ts`). 6 presets, no 5: además de Hoy/7 días/Este mes/Este trimestre/Personalizado se agregó **"Todos"** como default para los listados que hoy no filtraban por fecha en absoluto (Compras, Pendientes de Recepción, Cuentas Corrientes, Morosos) — sin él, desplegar el filtro habría ocultado de entrada todo el histórico existente (mostrando solo "hoy") sin que el usuario tocara nada. Decisión confirmada explícitamente con el usuario antes de implementar. `LogisticsPage` es la única excepción: default `'today'`, porque preserva el comportamiento que ya tenía (antes fijo a `todayISO` hardcodeado, ahora seleccionable).

Cálculo de rangos con `Date` nativo (sin `date-fns`/`dayjs`): 4 presets fijos no justifican una librería nueva. `dateTo` de los presets fijos es siempre HOY (el rango se abre hacia atrás, nunca incluye fechas futuras).

**Campo de fecha por servicio (no es el mismo nombre en todos, investigado antes de implementar):**
| Listado | Campo filtrado | Semántica |
|---|---|---|
| Compras (ambos) | `PurchaseOrder.createdAt` | fecha de emisión de la OC |
| Logística | `Delivery.date` | día de la entrega (antes exact-match, ahora rango) |
| Cuentas Corrientes | `ClientTransaction.date` (existencia) | ver punto 4 |
| Clientes Morosos | `OpenInvoice.dueDate` | vencimiento de la factura |

Comparación de rango normalizada a la porción `yyyy-MM-dd` (`dateISO.slice(0, 10)`) en los tres servicios que la implementan — necesario para `createdAt` (ISO datetime completo: sin esto, una orden creada HOY a cualquier hora quedaba excluida de un rango cuyo `dateTo` es hoy, por la porción de hora del datetime).

**Excepción explícita — `TabLowStock` queda AFUERA de Tarea A:** `StockedInventoryItem` (`InventoryItem & ProductStock`) no tiene ningún campo de fecha — es una foto del stock actual en un momento dado, no un registro histórico con fecha propia. Se evaluó agregar un campo nuevo (`lastMovementDate` u similar) y se descartó explícitamente: hubiera significado inventar un dato en el mock sin que ningún caso de uso real lo pidiera, solo para completar el patrón de las otras 5. `TabLowStock` sí recibe Tareas B (ya tenía `branchId`, sin cambios) y C (Exportar) con normalidad.

**Caso Logística — cambio de comparación exacta a rango:** `DeliveryQueryFilters.date: string` (exact-match) se reemplazó por `dateFrom?/dateTo?` (extiende `DateRangeQueryFilters`); `matchesScope` pasó de `delivery.date === filters.date` a un rango. No es solo agregar un campo — es lógica de filtrado reescrita — por eso quedó documentado aparte del resto.

### 3. Tarea A — Cuentas Corrientes: Opción A (filtro de existencia), confirmada explícitamente
`ClientAccount` (la fila que lista esta vista) no tiene fecha propia — es un resumen ya agregado (`totalDebit`/`totalCredit`/`currentBalance`). Se plantearon dos opciones antes de implementar: (A) mostrar solo clientes con al menos una transacción en el rango, sin tocar los totales de la fila; (B) recalcular los totales considerando solo transacciones del rango. **Se implementó la Opción A**, decisión explícita del usuario: la B es una feature de reportería distinta (cambia el significado de un número que el usuario espera que sea el saldo real de la cuenta), no lo que se pidió ("filtrar el listado"). `hasTransactionInRange` (`clients.service.ts`) es un filtro de existencia puro — `client.transactions.some(t => isWithinDateRange(t.date, ...))` — nunca toca `totalDebit`/`totalCredit`/`currentBalance`.

### 4. Tarea A — Clientes Morosos: `dueDate` como dimensión ADICIONAL al aging, cache restructurado
Confirmado explícitamente con el usuario: el rango de fecha filtra por `dueDate` de las facturas vencidas, **coexistiendo** con el tramo de aging (`bucketFilter`) — son dos filtros independientes sobre el mismo conjunto de facturas abiertas, no uno reemplaza al otro. El cálculo de tramos (relativo a HOY, `bucketForDays`/`imputeOpenInvoices`) **no se tocó**.

Esto obligó a restructurar `getOverdueClientsPage`: `overdueSnapshotCache` (invalidado por día + referencia de `clientsStore`, con un comentario explícito diciendo que es "invariante respecto de la consulta") seguía siéndolo — el cache en sí no cambió ni se invalida por rango de fecha. Lo que se agregó es un paso **posterior** a leer el cache: `applyDateRangeToSnapshot` recorta `entry.openInvoices` de cada cliente cacheado al rango pedido y **recomputa** `oldestOverdueDays`/`oldestBucket`/`overdueByCurrency` solo sobre ese subconjunto, vía un helper nuevo extraído (`buildOverdueRow`, compartido con `computeOverdueSnapshot` para no duplicar esa lógica). Un cliente sin ninguna factura vencida dentro del rango elegido desaparece del scope, igual criterio que "al día" (M8).

### 5. Tarea B — Depósito = sinónimo de Sucursal, sin entidad nueva
Confirmado en el relevamiento previo (ver sesión anterior) y por decisión explícita del usuario: "depósito" no existe como concepto de dominio separado de `Branch` en ningún lado del código (el único hit real era `category: 'Almacen'`, una categoría de producto, no una ubicación física). **No se creó ningún tipo/entidad nueva.** Único cambio: copy. `BranchSelector.tsx` (aria-labels del trigger y del listbox, texto placeholder antes de cargar sesión) y `PurchaseOrderFilters.tsx` (label del `<select>` de sucursal del listado general de Compras) pasan de "Sucursal" a "Sucursal / Depósito". Los mensajes de `toast` (confirmación de cambio de sucursal, error de sucursal inactiva) se dejaron sin tocar a propósito — son feedback transitorio de una acción puntual, no un label persistente, y "Sucursal / Depósito activa: Centro." lee peor en una oración que como caption de un campo.

No se tocaron los listados manuales vs. auto-filtrados existentes (decisión ya tomada y documentada — ver sección de `TabPendingReceipt` más arriba): el listado general de Compras sigue con filtro manual de sucursal a propósito, ninguno de los otros 5 tiene un `<select>` de sucursal propio (reciben `branchId`/auto-filtran por `activeBranchId`), así que el único lugar con un label de sucursal editable además del Header es ese único `<select>`.

**Impacto de layout:** ninguno relevante. El trigger del Header muestra el NOMBRE real de la sucursal activa (ej. "Sucursal Centro"), nunca la palabra genérica "Sucursal" — el cambio de copy solo afecta accesibilidad (aria-label, invisible) y el placeholder que se ve brevemente antes de que cargue la sesión. El label de `PurchaseOrderFilters` pasa de 8 a ~19 caracteres pero el grupo ya tenía `min-width: 12rem` con el label arriba del `<select>` (columna, no fila) — no rompe layout.

### 6. Tarea C — `xlsx` instalado desde CDN de SheetJS, no desde el registry de npm
`npm install xlsx` (registry de npm, v0.18.5) trae 2 vulnerabilidades HIGH sin fix disponible en npm (Prototype Pollution GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) — SheetJS dejó de publicar versiones parcheadas al registry por una disputa con npm, y solo las distribuye desde `cdn.sheetjs.com`. Nuestro uso es exclusivamente de escritura (generar el archivo desde datos ya filtrados, nunca parsear un archivo subido por un usuario — que es donde viven esas vulnerabilidades), pero se decidió igual, con el usuario, instalar la versión parcheada: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz --save`. `package.json` queda con una URL en vez de un rango semver para esta dependencia — `npm audit` no la puede versionar automáticamente después de esto, así que una futura actualización de `xlsx` va a requerir repetir el mismo comando a mano con la URL vigente en cdn.sheetjs.com, no un `npm update` normal.

### 7. Tarea C — Export por servicio: función nueva reusando el filtro, no `PageQuery` con `pageSize: 'all'`
Se evaluaron dos formas de exponer "traer todo lo filtrado sin paginar" antes de implementar: (a) ensanchar `PageQuery.pageSize` para aceptar `'all'` además de `number`, resuelto internamente al tope; (b) una función de servicio nueva por listado (`exportX`), que reusa el mismo filtro+orden que `getXPage` vía un helper interno compartido, sin duplicar esa lógica.

**Se eligió (b).** `PageQuery`/`PageResult` (`shared/types/pagination.types.ts`) es un contrato ya en uso por los 6 listados migrados y, potencialmente, cualquier módulo futuro que migre — ensancharlo con un valor especial de `pageSize` para un caso de uso exclusivo de export (que además tiene semántica distinta: no hay número de página, hay un tope duro y una bandera `truncated`) lo haría más ambiguo para todo el resto sin necesidad. Se agregó en cambio `ExportResult<TItem> = { items, truncated }` (tipo nuevo, no reutiliza `PageResult`) y `MAX_EXPORT_ROWS = 10_000` (`pagination.types.ts`), y cada servicio extrajo su lógica de filtro+orden a una función interna compartida entre `getXPage` y `exportX` (`filterOrdersInScope`/`sortOrders` en Compras, `filterDeliveriesInScope`/`sortDeliveries` en Logística, `filterClientAccountsInScope`/`sortClientAccounts` y `applyDateRangeToSnapshot`/`sortOverdueEntries` en Clientes, `filterAndSortLowStock` en Inventario) — cero lógica de filtrado duplicada entre paginado y export en ninguno de los 5 servicios.

Si el total filtrado excede `MAX_EXPORT_ROWS`, `exportX` corta ahí y devuelve `truncated: true`; `ExportButton` (`shared/components/ui/`) lo traduce a un `toast.warning` explícito en vez de fallar silenciosamente o intentar traer más.

### 8. Tarea C — `ExportButton` genérico, deuda técnica de export client-side documentada
`shared/components/ui/ExportButton.tsx`: recibe `fetchRows` (función que trae los datos ya filtrados, provista por cada listado — el componente no conoce ningún service específico), `columns` (traducción de cada fila a columnas con headers en español, reusando labels ya existentes como `purchaseOrderLabels.ts`/`agingLabels.ts` donde aplica) y `fileNamePrefix`. Genera Excel y CSV desde la MISMA hoja (`XLSX.utils.json_to_sheet` → `XLSX.writeFile` para `.xlsx`, `XLSX.utils.sheet_to_csv` + `Blob`/`<a download>` nativo para `.csv`, sin sumar `file-saver`) — una sola fuente de verdad de las columnas para los dos formatos. CSV con BOM UTF-8 para que Excel en Windows no rompa acentos/ñ al abrirlo con doble-click.

**Deuda técnica conocida, no decisión final:** exportar trae el dataset filtrado completo (hasta `MAX_EXPORT_ROWS`) al cliente antes de generar el archivo, porque no existe backend todavía — el mock service simula el filtrado pero el archivo se arma en el browser. Cuando exista un backend real, esto debería migrar a generación server-side (el backend arma el archivo y lo sirve como descarga), evitando traer 10.000 filas crudas al cliente solo para transformarlas en Excel ahí. Queda anotado a propósito para que ese cambio futuro no se lea como una regresión de diseño.

### 9. No se tocó `TabImportExport.tsx`
Sus dos botones "Exportar Inventario (CSV)"/"Exportar Lista de Precios" siguen decorativos (sin `onClick`), tal como se pidió explícitamente — pertenecen a otro alcance (import/export masivo de todo el catálogo, no un listado paginado filtrado) y no se activaron ni se borraron.

## [03/09/2026] — Contención de errores en dos niveles (Tanda 0 de escalabilidad)

### 1. Contexto
Primera tanda de un plan de escalabilidad derivado de `docs/AUDITORIA_ESCALABILIDAD.md`: red de seguridad ante errores, deliberadamente ANTES de tocar la capa de datos (Tanda 1), porque cualquier refactor posterior necesita poder fallar sin tirar abajo toda la aplicación. Ataca el hallazgo D4 de la auditoría ("sin `ErrorBoundary` global — un error de render no capturado en cualquier punto fuera de los 6 boundaries locales rompe toda la aplicación a pantalla en blanco").

### 2. Dos niveles de contención, no uno
- **Global** (`shared/routes/AppRoutes.tsx`): envuelve `<Routes>` (adentro de `<BrowserRouter>`, no afuera — el fallback usa `<Link to="/">` para "Volver al inicio", que necesita contexto de Router). Es la red de última instancia: si algo rompe fuera de una ruta puntual (el propio `AppShell`, `Sidebar`, `Header`), este boundary lo atrapa.
- **Por ruta** (`shared/layouts/AppShell.tsx`): envuelve solo `<Outlet />`, con `resetKey={location.pathname}`. Si el módulo que se está viendo rompe, el resto de la app (Sidebar, Header, selector de sucursal) sigue vivo — el usuario puede navegar a otra sección sin recargar la página. `resetKey` atado al pathname hace que cambiar de ruta limpie el estado de error automáticamente: sin esto, el usuario podía quedar "atrapado" viendo el fallback de una pantalla que ya abandonó.

### 3. Se extendió el `ErrorBoundary` existente, no se creó uno nuevo
Antes de escribir código se encontró que `src/shared/components/ui/ErrorBoundary.tsx` ya existía (51 líneas, class component, usado en 6 puntos: `ClientAccountsTable`, `ClientOverdueTable`, `TabPendingReceipt`, `ComprasPage`, `TabLowStock`, `LogisticsPage`, todos con las props `fallbackTitle`/`fallbackMessage`). Se extendió ese mismo archivo — agregando `fallback` (render prop), `onReset`, `resetKey` con auto-reset en `componentDidUpdate`, y los botones "Reintentar"/"Volver al inicio" al fallback por default — en vez de crear un componente paralelo. Retrocompatible: los 6 usos existentes siguen funcionando sin tocarlos, heredan el fallback nuevo (con los dos botones) automáticamente porque ninguno pasa `fallback` custom.

**Por qué class component, no hook:** React no tiene equivalente en hooks para `getDerivedStateFromError`/`componentDidCatch` — un error boundary tiene que ser una clase, sin excepción, con cualquier versión de React actual (incluida la 19 de este proyecto).

**Por qué sin librería externa (`react-error-boundary` u otra):** decisión explícita de la tarea, coherente con la norma de no-duplicación ya vigente en el proyecto (`[25/08/2026] — Utilidades Esenciales del Frontend`) — el boundary a mano ya cubre lo que se necesita (dos niveles, reset manual y automático, fallback custom opcional) sin sumar una dependencia nueva para ~80 líneas de lógica.

### 4. `logError` — punto único de logging, enganche para telemetría futura
`shared/utils/logError.ts`: `logError(error: unknown, context?: Record<string, unknown>): void`, hoy hace `console.error('[SDGPD]', { message, stack, context, timestamp })`. Se llama desde `ErrorBoundary#componentDidCatch` (pasando `{ componentStack: errorInfo.componentStack }` como contexto). El punto de la función es ser el único lugar que un día cambie para mandar errores a un servicio real (Sentry, un endpoint propio) — ese día cambia la implementación de `logError`, no cada uno de los lugares que la llaman. No se integró ningún servicio externo ahora (fuera de alcance explícito).

### 5. Por qué se recreó `shared/utils/`
La carpeta se había eliminado explícitamente en la limpieza del 28/08 (`FrontEnd/CLAUDE.md`, sección "Removed placeholder folders") por estar vacía/sin uso real, con la nota explícita de "no recrear sin decisión nueva que lo justifique explícitamente". Esta es esa decisión: `logError.ts` no es un placeholder — tiene un consumidor real e inmediato (`ErrorBoundary`) desde el momento en que se creó, y es exactamente el tipo de utilidad genérica (sin conocimiento de dominio, sin componente) para la que esa carpeta existe en cualquier proyecto React convencional. No se recreó ninguna otra de las carpetas eliminadas en esa limpieza (`core/`, `infrastructure/`, `shared/services/`, `modules/_template/`).

### 6. `ErrorState`/`LoadingState` — creados, sin cablear todavía
`shared/components/ui/{ErrorState,LoadingState}.tsx`: componentes genéricos para estados async (a diferencia de `ErrorBoundary`, que atrapa errores de *render*, estos son para cuando un fetch ya resolvió con error, o todavía no resolvió). Se crearon en esta tanda pero **no se cablearon en ningún listado todavía** — eso quedó para la tanda siguiente (Tanda 1, piloto `suppliers`), a propósito: esta tanda es solo infraestructura de contención, no una pasada de UI sobre los 22 listados de la auditoría.

### 7. Verificación funcional
**Verificación funcional en navegador: PARCIAL (04/09/2026)** — se confirmó el escenario normal en Proveedores (carga contra la capa `api/`, paginación y orden server-side, alta de proveedor), sin regresiones visuales ni errores. Los escenarios de Tanda 0 (provocar un error de render) y varios de Tanda 1 (latencia alta, fallo forzado, reintentos con debug, deep-link, cancelación por tipeo, cambio de sucursal) todavía no se ejecutaron. Detalle completo, punto por punto, en `docs/VERIFICACION_TANDA_0_1.md`.

