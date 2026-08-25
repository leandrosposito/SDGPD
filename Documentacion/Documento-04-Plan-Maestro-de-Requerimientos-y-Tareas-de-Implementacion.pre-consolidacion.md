# Documento 04 — Plan Maestro de Requerimientos y Tareas de Implementación

Este documento representa el Backlog Maestro ejecutable del ERP, derivado estrictamente de los Documentos 01, 02 y 03.
Garantiza cobertura funcional total y elimina funcionalidades no respaldadas.

## 1. Métricas Iniciales del Backlog

- **Total RF Consolidados:** 83
- **Duplicados:** 0
- **Placeholders / Entradas genéricas:** 0

### Distribución por Evolución del Producto (Etapa)
| Etapa | Total Asignado |
|---|---|
| MVP | 61 |
| Crecimiento | 18 |
| Enterprise | 4 |
| **Total** | **83** |

---

## 2. Inventario Maestro de Requerimientos Funcionales

### RF-ORG-001: Gestión Central de Empresa
- **Módulo**: Organización (ORG)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Proveer la entidad base que representa la razón social principal sobre la que opera el ERP.
- **Alcance funcional**: Permite registrar y modificar los datos fiscales, comerciales y logotipos de la empresa matriz. Toda transacción del sistema (factura, orden de compra) hereda estos datos en su membrete.
- **Actores**: Administrador del Sistema.
- **Datos involucrados**: Razón Social, CUIT/RUT, Dirección Legal, Logo, Condición Fiscal, Régimen Impositivo.
- **Flujo principal**: 1. Admin accede a Configuración > Empresa. 2. Modifica datos. 3. Sistema valida CUIT. 4. Guarda y actualiza caché global.
- **Estados y transiciones**: [Activa]. No admite baja, solo modificación.
- **Reglas de negocio**: Solo puede existir 1 empresa matriz configurada. El CUIT debe ser válido según formato fiscal.
- **Validaciones**: Formato CUIT. Archivo de logo < 2MB.
- **Dependencias**: Ninguna.
- **Eventos**: `Empresa.Actualizada`.
- **Impactos**: Facturación (Membretes), Reportes.
- **Criterios de aceptación**: Se deben poder actualizar los datos y ver reflejado el cambio instantáneamente en un reporte o proforma nueva.

## Checklist de Implementación
### Análisis
- [ ] Definir endpoints para lectura/escritura de datos de empresa.
### Frontend
- [ ] Crear vista `Configuración > Empresa`.
- [ ] Implementar formulario con validación de CUIT.
- [ ] Subida de imagen (logo) con previsualización.
### Backend
- [ ] Crear API REST `/api/v1/org/empresa`.
- [ ] Implementar middleware de validación fiscal.
### Base de Datos / Persistencia
- [ ] Crear tabla `org_empresas`.
- [ ] Insertar registro semilla (seed) inborrable.
### QA
- [ ] Verificar bloqueo de eliminación de la empresa.
### Definition of Done
- [ ] Funcionalidad desplegada. Pruebas unitarias en verde.

---

### RF-ORG-002: Gestión de Sucursales y Depósitos Físicos
- **Módulo**: Organización (ORG)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Representar las ubicaciones físicas donde opera la empresa y se almacena inventario.
- **Alcance funcional**: ABM de Sucursales y Depósitos. Un depósito puede pertenecer a una sucursal o ser independiente. Se usan para geolocalizar stock y asignar punto de venta fiscal.
- **Actores**: Administrador.
- **Datos involucrados**: ID, Nombre, Dirección Física, Coordenadas, Tipo (Sucursal/Depósito), Punto de Venta Fiscal Asociado.
- **Flujo principal**: 1. Admin ingresa a Sucursales. 2. Crea nueva ubicación. 3. Asigna Punto de Venta. 4. Guarda.
- **Estados y transiciones**: [Activo] <-> [Inactivo].
- **Reglas de negocio**: No se puede inactivar un depósito si tiene stock > 0.
- **Validaciones**: Nombre único. Dirección obligatoria.
- **Dependencias**: RF-ORG-001.
- **Impactos**: Inventario, Facturación, Logística.
- **Criterios de aceptación**: Un depósito creado debe aparecer como destino válido en una orden de compra y origen válido en ventas.

## Checklist de Implementación
### Análisis
- [ ] Modelar relación 1 a N entre Empresa y Sucursales/Depósitos.
### Frontend
- [ ] Crear grilla ABM de Sucursales y Depósitos.
- [ ] Selector de Punto de Venta fiscal.
### Backend
- [ ] API `/api/v1/org/locations`.
- [ ] Lógica de bloqueo de inactivación si hay stock (consulta a microservicio INV).
### Base de Datos / Persistencia
- [ ] Crear tabla `org_locations`.
### Integraciones
- [ ] Proveedor de mapas para validación de dirección (opcional).
### QA
- [ ] Intentar inactivar depósito con stock y validar mensaje de error.
### Definition of Done
- [ ] Endpoint seguro, pruebas completadas.

---

### RF-ORG-003: Configuración General y Parámetros del Sistema
- **Módulo**: Organización (ORG)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Centralizar las variables operativas transversales del ERP que no dependen de una entidad específica.
- **Alcance funcional**: Interfaz clave-valor tipada para manejar configuraciones globales (ej: "Días de validez de cotización", "Tolerancia de recepción").
- **Actores**: Administrador.
- **Datos involucrados**: Clave, Valor, Tipo de Dato (Entero, Booleano, String), Grupo de Configuración.
- **Flujo principal**: 1. Acceso a Configuración Global. 2. Filtrado por grupo (Ventas, Compras). 3. Actualización de valor. 4. Sistema purga caché.
- **Reglas de negocio**: Los parámetros core no pueden eliminarse, solo modificarse.
- **Impactos**: Transversal a todo el sistema.
- **Criterios de aceptación**: Al cambiar la tolerancia de recepción, la nueva Orden de Compra debe adoptar el nuevo límite inmediatamente.

## Checklist de Implementación
### Backend
- [ ] Crear motor de configuración tipado en caché (Redis/Memcached).
- [ ] Endpoints de lectura masiva y actualización.
### Frontend
- [ ] Formulario dinámico basado en tipo de dato (switch para booleanos, input number para enteros).
### Base de Datos / Persistencia
- [ ] Tabla `sys_settings` pre-poblada con seeds.
### QA
- [ ] Modificar un parámetro y verificar invalidación de caché.
### Definition of Done
- [ ] Implementado.

---

### RF-ORG-004: Gestión de Unidades de Negocio y Centros de Costo
- **Módulo**: Organización (ORG)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Permitir la segregación contable y financiera de la empresa (ej: Mayorista vs Retail).
- **Alcance funcional**: Creación de jerarquías de Unidades de Negocio (UN) y Centros de Costo (CC). Asignación obligatoria de UN/CC en comprobantes de ingresos y egresos.
- **Actores**: Gerente Financiero.
- **Datos involucrados**: Código UN, Nombre, Jerarquía (Padre/Hijo), Responsable.
- **Estados y transiciones**: [Borrador] -> [Activo] -> [Archivado].
- **Reglas de negocio**: Los comprobantes financieros deben cruzar con una UN activa.
- **Impactos**: Finanzas, Tesorería, Reportes.
- **Criterios de aceptación**: Poder emitir un reporte de Estado de Resultados filtrado por una Unidad de Negocio específica.

## Checklist de Implementación
### Análisis
- [ ] Diseñar estructura de árbol recursivo para Centros de Costo.
### Frontend
- [ ] ABM con vista de árbol jerárquico.
- [ ] Componente selector de UN/CC para inyectar en formularios (facturas, OPs).
### Backend
- [ ] APIs anidadas `/api/v1/org/business-units`.
- [ ] Validaciones de ciclos infinitos en jerarquías.
### Base de Datos / Persistencia
- [ ] Tabla `org_business_units` con patrón Materialized Path o Adjacency List.
### QA
- [ ] Crear estructura de 3 niveles de profundidad y asignar comprobantes.
### Definition of Done
- [ ] Tareas terminadas, código en main.

---

### RF-IAM-001: Gestión y ABM de Usuarios Operativos
- **Módulo**: Usuarios y Accesos (IAM)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Controlar qué operadores físicos pueden autenticarse en el ERP.
- **Alcance funcional**: Alta, modificación y reseteo de claves de usuarios internos. Asignación a sucursales permitidas.
- **Actores**: Administrador.
- **Datos involucrados**: Nombre, Email (Username), Sucursal por defecto, Sucursales permitidas.
- **Reglas de negocio**: El email debe ser único global.
- **Criterios de aceptación**: Un usuario creado debe poder loguearse exitosamente con su contraseña temporal y ser forzado a cambiarla.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `iam_users` y tabla pivot `iam_user_locations`.
### Backend
- [ ] API de usuarios. Integración con hash de contraseñas (Argon2/Bcrypt).
### Frontend
- [ ] ABM de usuarios.
- [ ] Pantalla de Login y "Forzar cambio de clave".
### Integraciones
- [ ] Envío de email de bienvenida con token de un solo uso.
### QA
- [ ] Probar inicio de sesión con credenciales inválidas.
### Definition of Done
- [ ] Tareas completas.

---

### RF-IAM-002: Gestión de Roles y Permisos (RBAC)
- **Módulo**: Usuarios y Accesos (IAM)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Restringir el acceso a módulos y acciones según la función del usuario.
- **Alcance funcional**: Creación de Roles (ej: "Vendedor", "Tesorero") y asignación de Permisos granulares (ej: `sales.invoice.create`).
- **Reglas de negocio**: Un usuario asume los permisos de sus roles asignados.
- **Impactos**: Todo el sistema (Middlewares).

## Checklist de Implementación
### Análisis
- [ ] Definir nomenclatura de permisos (recurso.accion).
### Backend
- [ ] Middleware global para interceptar requests y verificar `hasPermission`.
### Frontend
- [ ] Directiva de UI (ej: `v-if="hasPermission('xyz')"`) para ocultar botones no autorizados.
### Base de Datos / Persistencia
- [ ] Tablas `iam_roles`, `iam_permissions`, `iam_role_permissions`.
### QA
- [ ] Entrar como Vendedor e intentar acceder a configuración. Debe devolver 403 Forbidden.
### Definition of Done
- [ ] Middleware y UI implementados.

---

### RF-IAM-003: Bloqueo, Suspensión y Ciclo de Vida de Usuarios
- **Módulo**: Usuarios y Accesos (IAM)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Gestionar la terminación o suspensión temporal del acceso operativo.
- **Alcance funcional**: Transicionar usuarios entre activo y bloqueado. Forzar cierre de sesión inmediato al bloquear.
- **Reglas de negocio**: Un usuario bloqueado pierde sus tokens de sesión instantáneamente. Un usuario bloqueado no puede ser reasignado a nuevos documentos.
- **Impactos**: Seguridad.

## Checklist de Implementación
### Backend
- [ ] Endpoint `/api/v1/iam/users/{id}/block`.
- [ ] Lógica de invalidación de JWT (lista negra temporal en Redis).
### Eventos y Auditoría
- [ ] Registrar log de quién bloqueó al usuario y el motivo.
### QA
- [ ] Bloquear a un usuario que tiene una sesión activa y verificar que su siguiente request de API rebota con 401 Unauthorized.
### Definition of Done
- [ ] Invalidación de sesión confirmada.

---

### RF-IAM-004: Gestión de Políticas de Contraseñas y Sesiones
- **Módulo**: Usuarios y Accesos (IAM)
- **Etapa**: Enterprise
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Elevar la seguridad corporativa cumpliendo normativas de compliance.
- **Alcance funcional**: Configuración de longitud mínima, complejidad de clave, caducidad (ej: 90 días), y timeout de inactividad de sesión.
- **Impactos**: IAM.

## Checklist de Implementación
### Backend
- [ ] Motor de validación de contraseñas basado en reglas configurables.
- [ ] Control de TTL de JWT basado en parámetro de sistema.
### Base de Datos / Persistencia
- [ ] Tabla de historial de contraseñas (para evitar repetición de las últimas N claves).
### Frontend
- [ ] Indicador de fortaleza de contraseña en tiempo real.
### QA
- [ ] Intentar poner "123456" con la política estricta activada.
### Definition of Done
- [ ] Implementado.

---

### RF-CLI-001: Gestión y ABM de Clientes
- **Módulo**: Clientes (CLI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Registro centralizado de las entidades B2B a las que se les vende y factura.
- **Alcance funcional**: Alta y modificación de clientes. Validación de CUIT/RUT contra entes fiscales.
- **Datos involucrados**: Razón Social, Nombre de Fantasía, CUIT, Condición IVA, Domicilio Fiscal, Categoría por defecto.
- **Reglas de negocio**: CUIT único e irrepetible.
- **Criterios de aceptación**: Poder crear un cliente, emitirle un presupuesto, y buscarlo por su nombre comercial.

## Checklist de Implementación
### Frontend
- [ ] Formulario completo de ABM.
- [ ] Botón de "Autocompletar datos desde Padrón Fiscal".
### Backend
- [ ] CRUD API `/api/v1/clients`.
### Integraciones
- [ ] Conexión a API de Constancia de Inscripción (AFIP/SII) para autocompletar razón social.
### QA
- [ ] Intentar crear dos clientes con el mismo CUIT.

---

### RF-CLI-002: Gestión de Datos Comerciales y Límites de Crédito
- **Módulo**: Clientes (CLI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Configurar las reglas operativas de venta por cliente.
- **Alcance funcional**: Asignación de Lista de Precios, Vendedor responsable, Condición de Venta (Contado/Cta Cte), y Límite de Crédito Monetario.
- **Reglas de negocio**: Si Condición de Venta es Cta Cte, el límite de crédito es obligatorio > 0.
- **Impactos**: Ventas, Pedidos (Bloqueos de crédito).

## Checklist de Implementación
### Análisis
- [ ] Definir cómo interacciona el límite de crédito con los cheques en cartera.
### Backend
- [ ] Extender modelo de cliente con campos comerciales.
### Validaciones
- [ ] Validar integridad (ej: la lista de precios asignada debe existir).
### Frontend
- [ ] Tab "Comercial" dentro de la ficha del cliente.
### QA
- [ ] Asignar límite de crédito 1000 a un cliente y probar su guardado.

---

### RF-CLI-003: Ficha 360 y Consulta de Historial
- **Módulo**: Clientes (CLI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Proveer al vendedor una vista unificada del cliente.
- **Alcance funcional**: Panel resumen con estado de cuenta, últimos 5 pedidos, últimos pagos y productos más comprados.
- **Impactos**: CRM, Ventas.

## Checklist de Implementación
### Backend
- [ ] Endpoint agregador `/api/v1/clients/{id}/dashboard`.
### Base de Datos / Persistencia
- [ ] Índices optimizados en tablas de pedidos y facturas por `client_id`.
### Frontend
- [ ] Dashboard visual (Ficha 360).
### QA
- [ ] Verificar tiempos de respuesta < 500ms al cargar ficha de cliente con alta transaccionalidad.

---

### RF-CLI-004: Bloqueo, Morosidad y Estados del Cliente
- **Módulo**: Clientes (CLI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Cortar automáticamente la capacidad de compra de clientes con deuda.
- **Alcance funcional**: Transición de cliente de Activo a Bloqueado. Puede ser manual o automático (vía motor de morosidad).
- **Reglas de negocio**: Un cliente bloqueado no puede generar nuevos Pedidos, pero sí puede generar Recibos de Pago.
- **Eventos**: `Cliente.Bloqueado`.

## Checklist de Implementación
### Backend
- [ ] Job asíncrono diario que evalúa saldo vencido vs días de gracia para auto-bloquear.
- [ ] Middleware en módulo de Pedidos que aborte creación si cliente == Bloqueado.
### Eventos y Auditoría
- [ ] Log de cambio de estado.
### QA
- [ ] Intentar facturar a cliente bloqueado.

---

### RF-CLI-005: Gestión de Múltiples Direcciones y Contactos (B2B)
- **Módulo**: Clientes (CLI)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Soportar cadenas de retail que compran centralizado pero exigen entregas distribuidas.
- **Alcance funcional**: Crear N direcciones de entrega asociadas a 1 Cliente matriz. Crear N contactos (Responsable Compras, Tesorería).
- **Reglas de negocio**: Al facturar, el domicilio fiscal es el del Cliente Matriz, pero el remito usa la Dirección de Entrega seleccionada.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tablas `client_addresses` y `client_contacts`.
### Frontend
- [ ] Tabs de Direcciones y Contactos en ABM.
- [ ] Selector de Dirección de Entrega en el carrito de compras del Vendedor.
### QA
- [ ] Generar remito con dirección secundaria y validar impresión.

---

### RF-CLI-006: Agrupación, Zonas y Segmentación
- **Módulo**: Clientes (CLI)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Ordenar la cartera de clientes para ruteo logístico y políticas de precios masivas.
- **Alcance funcional**: Asignación de Zonas Logísticas, Canales de Venta (Mayorista, Kiosco, Supermercado) y Grupos Económicos.
- **Impactos**: Logística (Ruteo), Precios.

## Checklist de Implementación
### Backend
- [ ] CRUD de Zonas Logísticas y Canales.
- [ ] Extensión de filtros de búsqueda de clientes.
### Frontend
- [ ] Listas desplegables en ABM Cliente.
### QA
- [ ] Filtrar clientes por Zona "Norte" y verificar resultados.

---

### RF-PRO-001: Gestión y ABM de Proveedores
- **Módulo**: Proveedores (PRO)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Registro de entidades emisoras de bienes y servicios.
- **Alcance funcional**: Alta de proveedor. Tipificación (Bienes / Servicios). Condiciones impositivas.
- **Flujo principal**: Similar a Clientes, adaptado a egresos.
- **Reglas de negocio**: CUIT único.

## Checklist de Implementación
### Backend
- [ ] CRUD `/api/v1/suppliers`.
### Frontend
- [ ] Formulario de ABM.
### Base de Datos / Persistencia
- [ ] Tabla `suppliers`.

---

### RF-PRO-002: Parámetros Comerciales de Compras
- **Módulo**: Proveedores (PRO)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Definir condiciones pactadas con el proveedor.
- **Alcance funcional**: Asignación de Plazo de Pago habitual (ej: 30, 60 días) y Descuentos comerciales pactados de base.

## Checklist de Implementación
### Backend
- [ ] Incorporar `payment_terms_days` y `base_discount_pct`.
### Frontend
- [ ] Campos en tab Comercial del Proveedor.
### Integraciones
- [ ] El módulo de compras hereda automáticamente el plazo de pago para calcular vencimiento de factura.

---

### RF-PRO-003: Evaluación, Calificación y Bloqueo
- **Módulo**: Proveedores (PRO)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Evitar compras a proveedores no conformes.
- **Alcance funcional**: Bloqueo de proveedor. Registro de calificación cualitativa.
- **Reglas de negocio**: Un proveedor bloqueado no puede recibir Órdenes de Compra nuevas.

## Checklist de Implementación
### Backend
- [ ] Lógica de estados y middleware en OC.
### Eventos y Auditoría
- [ ] Logs de bloqueo.
### QA
- [ ] Emitir OC a proveedor inactivo (esperar fallo).


### RF-PRO-004: Gestión de Contactos de Proveedor
- **Módulo**: Proveedores (PRO)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Administrar diferentes interlocutores del lado del proveedor (Ventas, Cobranzas, Logística).
- **Alcance funcional**: Creación de múltiples contactos asociados al proveedor base.
- **Datos involucrados**: Nombre, Rol, Email, Teléfono.
- **Impactos**: Compras (Envío automático de Órdenes de Compra al contacto de "Ventas").

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Crear tabla `supplier_contacts`.
### Frontend
- [ ] Tab de Contactos en ABM de Proveedores.
### Integraciones
- [ ] Selector automático del email de contacto al enviar Orden de Compra por correo.

---

### RF-CAT-001: Jerarquía de Categorías de Inventario
- **Módulo**: Categorías (CAT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Organizar el catálogo de productos de forma lógica para reportes y búsqueda.
- **Alcance funcional**: ABM de un árbol de categorías n-nivel (ej: Bebidas > Gaseosas > Cola).
- **Reglas de negocio**: No se puede eliminar una categoría si tiene productos asociados.

## Checklist de Implementación
### Backend
- [ ] API estructurada en árbol.
- [ ] Middleware para validar existencia de productos antes del borrado.
### Frontend
- [ ] Tree-view component para visualización y drag & drop de nodos (opcional).
### QA
- [ ] Intentar borrar nodo padre con hijos y verificar bloqueo.

---

### RF-PRD-001: ABM Central de Productos
- **Módulo**: Productos (PRD)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Mantener el inventario maestro de artículos comercializables.
- **Alcance funcional**: Registro de producto, SKU, código de barras (EAN), descripción, categoría, estado (Activo/Inactivo) y unidad de medida base.
- **Datos involucrados**: SKU, Código Barras, Nombre, Descripción, Unidad Medida Base, Categoría ID, Estado.
- **Reglas de negocio**: SKU y Código de Barras deben ser únicos.
- **Impactos**: Transversal a Stock, Compras y Ventas.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `products` con unique index en `sku` y `barcode`.
### Frontend
- [ ] ABM de Productos con buscador predictivo por SKU o Descripción.
### Validaciones
- [ ] Evitar códigos de barra malformados (validación EAN-13 si aplica).

---

### RF-PRD-002: Vinculación Proveedores x Producto (Catálogo de Compras)
- **Módulo**: Productos (PRD)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Saber a quién comprar cada artículo.
- **Alcance funcional**: Asignar múltiples proveedores a un producto, estableciendo cuál es el "Proveedor Principal". Registro del "Código del Proveedor" (ya que el proveedor llama al producto distinto a nuestro SKU interno).
- **Reglas de negocio**: Solo puede haber un proveedor principal por producto.

## Checklist de Implementación
### Backend
- [ ] Tabla pivot `product_suppliers` con `supplier_code` y booleano `is_main`.
### Frontend
- [ ] Modal de asignación de proveedores desde la ficha del producto.
### QA
- [ ] Al marcar un proveedor como principal, desmarcar automáticamente al anterior.

---

### RF-PRD-003: Atributos y Variantes de Producto
- **Módulo**: Productos (PRD)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Soportar catálogos complejos que usan matrices (Ej: Ropa por Talle/Color, o Bebidas por Sabor).
- **Alcance funcional**: Creación de Plantillas de Atributos (ej: "Zapatillas") y generación de SKU hijos (Variantes) a partir de un Producto Padre.
- **Reglas de negocio**: El stock se mueve siempre a nivel de SKU variante, no del padre.

## Checklist de Implementación
### Análisis
- [ ] Modelar EAV (Entity-Attribute-Value) o JSONB para atributos dinámicos.
### Backend
- [ ] Generador combinatorio de variantes (Talle S,M,L x Color Rojo,Azul = 6 SKUs).
### Base de Datos / Persistencia
- [ ] Adaptar modelo `products` para soportar recursividad `parent_id`.
### Frontend
- [ ] UI matricial para cargar precios y stock inicial de variantes de un pantallazo.

---

### RF-PRD-004: Conversión de Unidades de Medida (UM)
- **Módulo**: Productos (PRD)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Soportar la disociación entre cómo se compra (ej: Pallet) y cómo se vende (ej: Unidad).
- **Alcance funcional**: Definir equivalencias a partir de la UM Base. (Ej: UM Base = Unidad. UM Compra = Caja de 12. UM Venta = Pack de 6).
- **Reglas de negocio**: Los movimientos de stock siempre se convierten y registran en la UM Base funcional.

## Checklist de Implementación
### Backend
- [ ] Motor matemático de conversión `cantidad * factor_conversion` al ingresar mercadería.
### Base de Datos / Persistencia
- [ ] Tabla `product_uom` (Unit of Measure) asociada al producto con el factor multiplicador.
### QA
- [ ] Comprar 1 "Caja x12", verificar que el stock aumentó 12 "Unidades".

---

### RF-PRI-001: Gestión de Listas de Precios
- **Módulo**: Precios (PRI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Mantener múltiples esquemas de precios para diferentes segmentos (Mayorista, Minorista).
- **Alcance funcional**: Creación de listas de precio. Asignación de precio de venta a productos específicos dentro de una lista.
- **Reglas de negocio**: Cada producto debe tener un precio en la "Lista Base" obligatoriamente.

## Checklist de Implementación
### Backend
- [ ] Tabla `price_lists` y `price_list_items`.
### Frontend
- [ ] Grilla tipo Excel (DataGrid) para carga rápida de precios masivos.
### QA
- [ ] Al facturar, el precio sugerido debe cruzar el producto con la lista asignada al cliente.

---

### RF-PRI-002: Motor de Reglas Comerciales Automáticas
- **Módulo**: Precios (PRI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Calcular precios de venta dinámicamente basados en el costo.
- **Alcance funcional**: Definir listas de precios dinámicas (ej: "Costo + 30%"). Al actualizarse el costo del producto, los precios de las listas atadas a reglas se actualizan solos.

## Checklist de Implementación
### Backend
- [ ] Event listener en la actualización de `costo_ultima_compra`. Al detonarse, recalcular y persistir los nuevos precios en las listas dependientes.
### QA
- [ ] Simular un incremento de costo y verificar si la Lista Minorista (+40%) subió automáticamente.

---

### RF-PRI-003: Gestión de Descuentos y Promociones
- **Módulo**: Precios (PRI)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Fomentar ventas mediante lógicas de descuento.
- **Alcance funcional**: Definir promociones por fecha, por cantidad (Lleve 3, Pague 2), o descuentos porcentuales a nivel línea de carrito.
- **Reglas de negocio**: Las promociones no son acumulables salvo configuración explícita.

## Checklist de Implementación
### Backend
- [ ] Motor de reglas (Rules Engine) evaluado durante el cálculo del total del Pedido.
### Base de Datos / Persistencia
- [ ] Entidad `promotions` con fechas inicio/fin y JSON de condiciones lógicas.

---

### RF-INV-001: Consulta de Stock Universal
- **Módulo**: Inventario (INV)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Visualización en tiempo real del stock disponible.
- **Alcance funcional**: Grilla de consulta cruzando Productos x Depósito.
- **Datos involucrados**: Stock Físico.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `inventory_stock` (Agregador de saldos por SKU y Location).
### Frontend
- [ ] Pantalla "Stock Actual" con filtros cruzados.

---

### RF-INV-002: Ajuste de Stock Manual
- **Módulo**: Inventario (INV)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Corregir discrepancias por mermas o roturas sin pasar por un circuito de compras.
- **Alcance funcional**: Emisión de documento de Ajuste (Positivo o Negativo) con motivo obligatorio.

## Checklist de Implementación
### Backend
- [ ] Endpoint de inserción de transacción de inventario.
### Validaciones
- [ ] Un ajuste negativo no puede dejar el stock físico en números rojos.

---

### RF-INV-003: Auditoría y Movimientos de Inventario (Kardex)
- **Módulo**: Inventario (INV)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Trazabilidad absoluta de por qué el stock subió o bajó.
- **Alcance funcional**: Registro inmutable de cada transacción logística (Entrada por Compra, Salida por Venta, Ajuste, Traslado).

## Checklist de Implementación
### Backend
- [ ] Patrón Event Sourcing para la tabla `inventory_transactions`. Toda tabla de saldos es solo una vista materializada de estas transacciones.
### QA
- [ ] Verificar que no haya forma de hacer UPDATE o DELETE sobre un movimiento logístico ya asentado.

---

### RF-INV-004: Traslados entre Depósitos
- **Módulo**: Inventario (INV)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Movilidad interna de la mercadería.
- **Alcance funcional**: Creación de Remito Interno. Resta stock del Origen, suma en Destino.

## Checklist de Implementación
### Backend
- [ ] Transacción ACID de base de datos que inserte el movimiento de salida y el de entrada sincrónicamente.
### Frontend
- [ ] Pantalla de nuevo Remito de Traslado.

---

### RF-INV-005: Trazabilidad por Lotes y Vencimientos
- **Módulo**: Inventario (INV)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Manejo de perecederos y control de calidad.
- **Alcance funcional**: Al recepcionar mercadería se exige número de Lote y Vencimiento. El stock se desagrega a nivel Lote.
- **Reglas de negocio**: Al facturar, el sistema aplica FEFO (First Expired, First Out) por defecto.

## Checklist de Implementación
### Backend
- [ ] Modificar estructura `inventory_stock` para incluir `batch_id`.
- [ ] Algoritmo de autoselección de lote por fecha de vencimiento en el checkout de preparación de pedidos.

---

### RF-INV-006: Ejecución de Inventario Físico (Conteos)
- **Módulo**: Inventario (INV)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Sincronizar el sistema con la realidad del galpón anualmente.
- **Alcance funcional**: Congelamiento lógico de un depósito. Toma de muestras. Generación automática de ajustes por diferencias.

## Checklist de Implementación
### Backend
- [ ] Flujo de estados: Generar Plantilla -> Cargar Conteo -> Calcular Diferencia -> Aprobar y Asentar.
### QA
- [ ] Cargar conteos parciales y validar que el ajuste resultante sea preciso.

---

### RF-INV-007: Gestión de Stock Reservado y Comprometido
- **Módulo**: Inventario (INV)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Evitar sobre-ventas.
- **Alcance funcional**: Separar el Stock Físico (lo que hay en el galpón) del Stock Disponible (lo que se puede vender).
- **Reglas de negocio**: Stock Disponible = Stock Físico - Stock Reservado. Al confirmar un Pedido de Venta, se incrementa el Stock Reservado. Al despachar el pedido, baja el Físico y baja el Reservado.

## Checklist de Implementación
### Análisis
- [ ] Refactorización matemática de las consultas de disponibilidad.
### Backend
- [ ] Eventos transaccionales ligados a la máquina de estados del Pedido (RF-PED-002) que modifiquen el campo `reserved_qty` de forma concurrente.
### QA
- [ ] Hacer un pedido por el 100% del stock físico y verificar que otro vendedor vea disponibilidad = 0.


### RF-CMP-001: Emisión de Orden de Compra (OC)
- **Módulo**: Compras (CMP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Formalizar el pedido de reposición de mercadería a un proveedor.
- **Alcance funcional**: Creación, edición y envío de documento valorizado de compras.
- **Datos involucrados**: Proveedor, Fecha, Depósito Destino, Líneas (SKU, Cantidad, Precio Unitario Pactado).
- **Flujo principal**: 1. Creada. 2. Enviada. 3. Recepcionada (parcial o total).
- **Impactos**: No toca stock físico, pero puede afectar métricas de "Stock en Tránsito".

## Checklist de Implementación
### Frontend
- [ ] ABM de Orden de Compra (Cabecera y Detalle).
### Backend
- [ ] CRUD API `/api/v1/purchases/orders`.
- [ ] Generación de PDF imprimible de la Orden.
### QA
- [ ] Validar que no se puede modificar una OC que ya está recepcionada parcialmente.

---

### RF-CMP-002: Recepción Fija y Gestión de Diferencias
- **Módulo**: Compras (CMP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Confirmar ingreso físico de mercadería pedida.
- **Alcance funcional**: Tomar una OC en estado "Enviada" y generar el parte de recepción (Remito de Compra). Si hay diferencias entre lo pedido y lo recibido, el sistema alerta y permite cerrar la línea corta o dejarla pendiente.
- **Impactos**: Aumenta el Inventario Físico.

## Checklist de Implementación
### Análisis
- [ ] Definir algoritmo de partición de OC en caso de backorder de compra.
### Backend
- [ ] Endpoint de ejecución de Recepción. Emite evento interno a módulo INV.
### QA
- [ ] Pedir 10 unidades, recibir 8. Comprobar que la OC queda "Parcial" y el stock sube 8.

---

### RF-CMP-003: Registro de Factura de Compra
- **Módulo**: Compras (CMP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Asentar la obligación de pago y registrar el crédito fiscal.
- **Alcance funcional**: Conciliación de la Factura recibida del proveedor contra los Remitos de Recepción previos. 
- **Impactos**: Genera deuda en Cuenta Corriente de Proveedores (RF-CCT-003).

## Checklist de Implementación
### Backend
- [ ] Lógica de enlace N a M: Múltiples remitos de compra pueden agruparse en 1 Factura.
- [ ] Creación de asiendo de deuda en la CCT de Proveedor.
### Frontend
- [ ] Pantalla "Cargar Factura de Compra".

---

### RF-CMP-004: Registro de Solicitud de Compra (Requisición)
- **Módulo**: Compras (CMP)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Formalizar necesidades de reposición interna antes de emitir la OC.
- **Alcance funcional**: Creación de un documento de solicitud por parte de un operario, sujeto a aprobación para convertirse en OC.

## Checklist de Implementación
### Backend
- [ ] Flujo de Aprobación. De Estado `Pendiente` a `Aprobado` o `Rechazado`.
### Frontend
- [ ] Bandeja de entrada de solicitudes para el encargado de compras.

---

### RF-CMP-005: Devolución a Proveedor
- **Módulo**: Compras (CMP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Mecanismo inverso por fallas de calidad posteriores a la recepción.
- **Alcance funcional**: Generación de Remito de Devolución. Resta stock.
- **Impactos**: Requiere cargar una Nota de Crédito del proveedor para balancear la CCT.

## Checklist de Implementación
### Backend
- [ ] Flujo inverso de stock (salida de depósito hacia proveedor externo).
### QA
- [ ] Validar que no se puede devolver más cantidad de la que se compró originalmente en la factura vinculada.

---

### RF-CMP-006: Actualización Automática de Precios y Costos
- **Módulo**: Compras (CMP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Mantener la rentabilidad actualizada.
- **Alcance funcional**: Al cerrar la Factura de Compra, el sistema compara el precio unitario nuevo contra el `costo_ultima_compra` en el maestro de Productos y lo actualiza si varió.

## Checklist de Implementación
### Backend
- [ ] Listener de evento `FacturaCompra.Asentada` que actualiza el maestro de productos.
### Eventos y Auditoría
- [ ] Log de cambio de costos por sistema (quién compró, a cuánto estaba, a cuánto pasó).

---

### RF-VEN-001: Gestión de Presupuestos y Cotizaciones
- **Módulo**: Ventas (VEN)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Emitir propuestas comerciales a clientes sin comprometer stock logístico.
- **Alcance funcional**: ABM de cotizaciones con validez en días.
- **Flujo principal**: Se carga el cliente, se agregan ítems, el sistema aplica la lista de precios (RF-PRI-001), se guarda y se envía PDF.

## Checklist de Implementación
### Frontend
- [ ] Interfaz rápida de carrito B2B.
### Backend
- [ ] Cálculo en tiempo real de totales y subtotales.

---

### RF-VEN-002: Devoluciones Comerciales (Gestión de RMA)
- **Módulo**: Ventas (VEN)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Proceso de recepción de reclamos post-venta de clientes.
- **Alcance funcional**: Creación de Ticket de Devolución, que al autorizarse, genera orden de retiro logístico (Remito X) y emite Nota de Crédito.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `rma_tickets`.
### Backend
- [ ] Máquina de estados: Registrado, Autorizado (Genera Remito), Recibido (Suma Stock), Cerrado (Genera NC).

---

### RF-VEN-003: Autorizaciones y Aprobaciones Especiales de Venta
- **Módulo**: Ventas (VEN)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Evitar ventas de alto riesgo.
- **Alcance funcional**: Si un presupuesto o pedido supera el límite de crédito del cliente (RF-CLI-002), el estado pasa a "Pendiente de Autorización Gerencial".

## Checklist de Implementación
### Backend
- [ ] Middleware interceptor en la transición a "Confirmado". Si sobrepasa límite, detiene el flujo.
### Frontend
- [ ] Vista para Gerentes con listado de pedidos trabados y botón Aprobar/Rechazar.

---

### RF-VEN-004: Registro de Venta Directa (POS / Mostrador)
- **Módulo**: Ventas (VEN)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Proveer un flujo alternativo síncrono donde cliente, pago, entrega y facturación ocurren al mismo tiempo.
- **Impactos**: No genera picking ni ruteo. Resta stock físico directo e ingresa pago a caja (RF-TES-001).

## Checklist de Implementación
### Frontend
- [ ] Pantalla rápida estilo POS (Punto de Venta) sin burocracia logística.
### Backend
- [ ] Transaction de Base de datos que consolide: Factura + Cobro + Baja de Stock Físico atómicamente.

---

### RF-PED-001: Gestión y Alta de Pedidos de Venta
- **Módulo**: Pedidos (PED)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Registrar la intención de compra formal del cliente, gatillando el proceso logístico.
- **Alcance funcional**: Conversión de Presupuesto a Pedido, o creación directa de Pedido. Congela precios pactados. Aumenta stock comprometido (RF-INV-007).

## Checklist de Implementación
### Backend
- [ ] API `/api/v1/orders`.
- [ ] Emisión asíncrona de evento `Pedido.Confirmado`.
### Validaciones
- [ ] Verificar disponibilidad de inventario lógico al momento de guardar.

---

### RF-PED-002: Ciclo de Vida del Pedido y Entregas Parciales
- **Módulo**: Pedidos (PED)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Orquestar el flujo desde la entrada hasta la entrega.
- **Alcance funcional**: Estados: Pendiente, En Preparación, Despachado, Entregado. Si hay quiebre de stock en piso (incidencia en RF-PRE-003), el sistema debe permitir despachar el saldo posible y automáticamente crear un "Sub-Pedido" (Backorder) con el resto pendiente.

## Checklist de Implementación
### Backend
- [ ] Máquina de Estados Finita (FSM) estricta en el modelo Order.
- [ ] Algoritmo de partición de pedido en dos IDs vinculados (Ej: Pedido 100 y Pedido 100-B).
### QA
- [ ] Confirmar pedido de 5 items. Preparar solo 3. Verificar que nacen 2 pedidos y el stock comprometido se ajusta.

---

### RF-PED-003: Panel de Filtros Avanzados y Semáforos
- **Módulo**: Pedidos (PED)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Control visual para el área administrativa.
- **Alcance funcional**: Listado de pedidos filtrable por fecha de entrega, zona, estado y estado de pago.

## Checklist de Implementación
### Frontend
- [ ] Datatable avanzado con colorización condicional (Rojo = Atrasado).
### Backend
- [ ] Scopes de base de datos optimizados para queries complejos de fechas.

---

### RF-PED-004: Modificación y Cancelación de Pedido Confirmado
- **Módulo**: Pedidos (PED)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Soportar cambios de idea del cliente previos al envío.
- **Alcance funcional**: Cancelación total (libera stock reservado). Modificación de líneas (exige re-validar stock reservado). Solo aplicable si el estado es < "Despachado".

## Checklist de Implementación
### Backend
- [ ] Lógica de reversión matemática de saldos en tabla de inventario lógico (RF-INV-007) antes de actualizar el Pedido.
### QA
- [ ] Intentar cancelar un pedido ya despachado y verificar error bloqueante.

---

### RF-PED-005: Trazabilidad y Consulta de Historial de Estados del Pedido
- **Módulo**: Pedidos (PED)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Auditoría temporal para atención al cliente.
- **Alcance funcional**: Timeline visual de qué usuario pasó el pedido a cada estado y en qué momento exacto.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `order_state_transitions`.
### Frontend
- [ ] Componente tipo Timeline vertical en la vista de lectura del Pedido.

---

### RF-PRE-001: Consolidación y Generación de Tareas de Picking
- **Módulo**: Preparación (PRE)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Transformar pedidos comerciales en órdenes de trabajo para los operarios del galpón.
- **Alcance funcional**: Emisión de listas de preparación. Agrupamiento de ítems por zona de depósito para optimizar caminata.

## Checklist de Implementación
### Backend
- [ ] API de generación de "Wave" o Cola de Picking.
### Frontend
- [ ] PDF Imprimible de "Hoja de Ruta de Almacén" agrupada por SKU en lugar de por Pedido.

---

### RF-PRE-002: Confirmación de Picking (Armado de Bultos)
- **Módulo**: Preparación (PRE)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Validar que la mercadería separada es exacta.
- **Alcance funcional**: El operario ingresa lo que encontró. El sistema compara contra lo solicitado.

## Checklist de Implementación
### Frontend
- [ ] Pantalla optimizada para tablets / colectoras de datos.

---

### RF-PRE-003: Tratamiento de Incidencias en Picking (Faltantes)
- **Módulo**: Preparación (PRE)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Resolver diferencias entre el sistema (que decía que había stock) y la realidad física (no se encontró).
- **Alcance funcional**: Si el operario declara "Faltante", el sistema genera automáticamente un Ajuste Negativo de Stock Físico (RF-INV-002) y detona el Backorder en el Pedido (RF-PED-002).

## Checklist de Implementación
### Integraciones
- [ ] Comunicación asíncrona entre el servicio de Picking, Inventario y Pedidos.
### QA
- [ ] Declarar falta de 1 item en armado. Validar que el stock físico baje y el pedido se particione sin error.

---

### RF-PRE-004: Priorización y Asignación de Tareas
- **Módulo**: Preparación (PRE)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Organizar el trabajo logístico masivo.
- **Alcance funcional**: Jefe de Depósito asigna manualmente las olas de preparación a operarios específicos (Pickers).

## Checklist de Implementación
### Backend
- [ ] Campo `assigned_to` en entidad PickingTask.
### Frontend
- [ ] Panel Kanban de Tareas (Por Hacer, En Progreso, Terminado).


### RF-LOG-001: Motor de Asignación y Enrutamiento Logístico
- **Módulo**: Logística (LOG)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Centralizar las decisiones de cómo enviar la mercadería preparada.
- **Alcance funcional**: Creación de un "Viaje" (Route) consolidando múltiples Remitos de Entrega. Se le asigna un Vehículo y Chofer.
- **Flujo principal**: Seleccionar N Pedidos Preparados -> Generar Viaje -> Imprimir Hoja de Ruta.
- **Dependencias**: Requiere que los pedidos estén en estado "Preparado".
- **Impactos**: Cambia el estado del pedido a "En Reparto / Despachado".

## Checklist de Implementación
### Frontend
- [ ] Selector múltiple de Remitos Listos.
### Backend
- [ ] Entidad `logistic_routes`. Lógica de sumatoria de bultos totales para no superar capacidad del camión.

---

### RF-LOG-002: ABM de Vehículos y Choferes
- **Módulo**: Logística (LOG)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Administrar la flota propia y tercerizada.
- **Alcance funcional**: Registro de dominios, capacidad en volumen/peso de los camiones, y datos personales de conductores.
- **Reglas de negocio**: Patentes únicas.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tablas `fleet_vehicles` y `fleet_drivers`.
### Frontend
- [ ] Formularios de ABM.

---

### RF-LOG-003: Seguimiento y Control de Recorridos en Ruta
- **Módulo**: Logística (LOG)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Monitorear entregas en tiempo real.
- **Alcance funcional**: El Viaje tiene estados: Creado, En Tránsito, Finalizado.

## Checklist de Implementación
### Backend
- [ ] Endpoint para cambiar estado del viaje.
- [ ] Eventos que notifiquen a la empresa al terminar el recorrido.

---

### RF-ENT-001: Confirmación de Entrega Física
- **Módulo**: Entregas (ENT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Asentar el éxito final de la transacción comercial y física.
- **Alcance funcional**: Operación que transiciona el Pedido al estado final "Entregado".

## Checklist de Implementación
### Backend
- [ ] Cierre definitivo del documento (lock de base de datos contra futuras modificaciones).

---

### RF-ENT-002: Rechazo Total de Mercadería
- **Módulo**: Entregas (ENT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Procesar la negativa del cliente al recibir el pedido completo en su puerta.
- **Alcance funcional**: Transiciona el Pedido a "Rechazado". Exige Motivo.
- **Impactos**: Genera automáticamente un movimiento de reingreso físico al stock.

## Checklist de Implementación
### Backend
- [ ] Creación de Remito Interno de Devolución Logística de forma automática.
### QA
- [ ] Rechazar un pedido y validar que la mercadería volvió al físico y la CCT reversó (o generó NC).

---

### RF-ENT-003: Reprogramación de Entregas
- **Módulo**: Entregas (ENT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Evitar reingresar mercadería que simplemente no se pudo entregar hoy.
- **Alcance funcional**: Estado alternativo del viaje. El remito vuelve a la cola de "Pendientes de Asignación Logística".

## Checklist de Implementación
### Backend
- [ ] Evento de desconexión entre el Viaje y el Remito.

---

### RF-ENT-004: Registro de Evidencia de Entrega (Proof of Delivery)
- **Módulo**: Entregas (ENT)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Respaldo legal.
- **Alcance funcional**: Captura de firma digital o foto del remito conformado.

## Checklist de Implementación
### Frontend
- [ ] Componente PWA/Móvil para captura de foto (Blob) usando la cámara del celular.
### Backend
- [ ] API de storage (S3 o Local) para guardar la evidencia ligada al ID del Pedido.

---

### RF-FAC-001: Emisión de Factura de Venta
- **Módulo**: Facturación (FAC)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Cumplimiento impositivo y generación de deuda en el cliente.
- **Alcance funcional**: Toma un Pedido o Remito y genera un documento fiscal (Factura A, B, C).

## Checklist de Implementación
### Backend
- [ ] Cálculo de impuestos (IVA, Percepciones) iterando líneas.
- [ ] Asiento en la CCT del Cliente (RF-CCT-001).
### QA
- [ ] Emitir factura y confirmar que el saldo deudor del cliente aumentó.

---

### RF-FAC-002: Emisión de Notas de Crédito
- **Módulo**: Facturación (FAC)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Corregir facturación errónea o respaldar devoluciones comerciales (RF-VEN-002).
- **Alcance funcional**: Documento fiscal negativo. Puede estar linkeado a una Factura madre.
- **Impactos**: Disminuye deuda en CCT.

## Checklist de Implementación
### Backend
- [ ] Validación de topes: La suma de Notas de Crédito no puede superar el monto de la Factura asociada.

---

### RF-FAC-003: Emisión de Notas de Débito
- **Módulo**: Facturación (FAC)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Registrar cargos adicionales post-facturación (ej: intereses por mora, cheques rechazados).
- **Alcance funcional**: Documento fiscal positivo. Aumenta la CCT.

## Checklist de Implementación
### Backend
- [ ] Inserción manual o derivada desde Tesorería ante un cheque rebotado.

---

### RF-FAC-004: Procesamiento de Facturación Masiva / Lotes
- **Módulo**: Facturación (FAC)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Eficientizar el backoffice B2B al cierre del día.
- **Alcance funcional**: Seleccionar múltiples Remitos Entregados y generar sus Facturas en background.

## Checklist de Implementación
### Backend
- [ ] Job en background (Queue worker) para procesar N iteraciones atómicas de RF-FAC-001 para no bloquear el request HTTP.
### Frontend
- [ ] Barra de progreso asíncrona.

---

### RF-CCT-001: Gestión de Cuenta Corriente y Saldos de Clientes
- **Módulo**: Cuentas Corrientes (CCT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Control financiero individual.
- **Alcance funcional**: Libro Mayor auxiliar por Cliente. Registra Facturas/ND al DEBE y Recibos/NC al HABER. Incluye el cálculo del Saldo Deudor consolidado y vencido.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `client_ledgers` con patrón de saldo acumulativo o vista calculada al vuelo.
### Backend
- [ ] API de lectura de Saldos Vencidos (para alimentar bloqueo automático RF-CLI-004).
### Frontend
- [ ] Pantalla "Resumen de Cuenta" exportable a PDF.

---

### RF-CCT-002: Conciliación (Aplicación de Documentos)
- **Módulo**: Cuentas Corrientes (CCT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Cancelación fina de comprobantes.
- **Alcance funcional**: Vincular lógicamente un Pago con una Factura específica para matarla y marcarla como Pagada.
- **Reglas de negocio**: Los pagos a cuenta generan saldos a favor pendientes de aplicación.

## Checklist de Implementación
### Backend
- [ ] Tabla `document_applications` (id_pago, id_factura, monto_aplicado).
### Frontend
- [ ] Modal drag & drop o checkboxes para tildar qué facturas cubre un recibo de cobro.

---

### RF-CCT-003: Gestión de Cuenta Corriente de Proveedores
- **Módulo**: Cuentas Corrientes (CCT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Espejo del proceso de clientes, pero manejando Pasivos de la empresa (A Pagar).
- **Alcance funcional**: Facturas de compra (Haber) y Órdenes de Pago (Debe).

## Checklist de Implementación
### Análisis
- [ ] Reutilizar la lógica de conciliación del RF-CCT-002, invertida contablemente.


### RF-TES-001: Gestión de Recibos de Cobro
- **Módulo**: Tesorería (TES)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Acreditar pagos recibidos de clientes.
- **Alcance funcional**: Creación de Recibo de Cobro. Se indica el cliente, los valores ingresados (Efectivo, Cheques, Transferencias) y las facturas que se cancelan.
- **Reglas de negocio**: La suma de valores debe ser igual a la suma de documentos aplicados (Partida Doble).
- **Impactos**: Baja saldo deudor del cliente en CCT. Ingresa dinero a Cajas/Bancos.

## Checklist de Implementación
### Frontend
- [ ] UI compleja de 3 paneles: Cabecera, Valores, Aplicaciones.
### Backend
- [ ] Transacción ACID que inserte recibo, actualice saldo cliente, cree registro en tabla de caja e inserte cheques en cartera si corresponde.
### QA
- [ ] Intentar guardar recibo desbalanceado y verificar validación cruzada.

---

### RF-TES-002: Gestión de Cajas y Cuentas Bancarias
- **Módulo**: Tesorería (TES)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Administrar el dinero líquido del distribuidor.
- **Alcance funcional**: ABM de cajas físicas por sucursal y cuentas bancarias. Registro manual de ingresos y egresos (gastos).

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tablas `cash_registers` y `cash_transactions`.
### Frontend
- [ ] Selector de caja en la cabecera de pagos y cobros.

---

### RF-TES-003: Emisión de Órdenes de Pago a Proveedores
- **Módulo**: Tesorería (TES)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Registrar salidas de dinero hacia terceros.
- **Alcance funcional**: Inverso al Recibo. El sistema permite seleccionar qué facturas a pagar cubrir, y con qué valores salir (Efectivo, Cheques propios, Cheques de Terceros endosados).

## Checklist de Implementación
### Backend
- [ ] Extensión del motor CCT-003 para asentar la Orden de Pago y descontar pasivo.

---

### RF-TES-004: Arqueo y Cierre de Caja
- **Módulo**: Tesorería (TES)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Control diario del efectivo manejado por operarios.
- **Alcance funcional**: Bloqueo de la caja a cierta hora, conteo ciego del operador, comparación contra el sistema por parte del supervisor, y generación automática de ajuste por sobrante/faltante.

## Checklist de Implementación
### Backend
- [ ] Flujo lógico: Apertura -> Operación -> Pre-Cierre -> Cierre Definitivo.

---

### RF-TES-005: Gestión de Múltiples Medios de Pago y Cartera de Cheques
- **Módulo**: Tesorería (TES)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Trazabilidad del papel en plaza.
- **Alcance funcional**: Si un cobro incluye cheques, cada cheque se guarda como entidad independiente con estado "En Cartera". El usuario puede "Depositarlo" o "Endosarlo" para pagar a un proveedor.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Tabla `checks` con ciclo de vida (En Cartera, Depositado, Rechazado, Entregado).
### QA
- [ ] Entregar un cheque de tercero a un proveedor y confirmar que ya no aparece en el arqueo de caja.

---

### RF-FIN-001: Catálogo de Cuentas Contables y Asientos Automáticos
- **Módulo**: Finanzas (FIN)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Enlace financiero.
- **Alcance funcional**: ABM de un Plan de Cuentas básico. Mapeo de eventos (Ej: Venta -> Cuenta de Ingresos, Cobro -> Cuenta de Caja). Generación automática del Asiento contable.

## Checklist de Implementación
### Backend
- [ ] Event listeners que capturen los triggers de Facturación y Cobranza para insertar minutas contables.

---

### RF-FIN-002: Flujo de Fondos (Cashflow Proyectado)
- **Módulo**: Finanzas (FIN)
- **Etapa**: Enterprise
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Visión predictiva.
- **Alcance funcional**: Reporte cruzando fechas de vencimiento de Cuentas a Cobrar vs Cuentas a Pagar + Saldos actuales de bancos + Cheques diferidos emitidos y recibidos.

## Checklist de Implementación
### Backend
- [ ] Query agregador masivo agrupado por día, semana y mes.
### Frontend
- [ ] Gráfico de barras de proyección financiera de 30 a 90 días.

---

### RF-REP-001: Reportes Operativos Nativos
- **Módulo**: Reportes (REP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Listados transaccionales del día a día.
- **Alcance funcional**: Libro IVA Ventas, IVA Compras, Stock Valorizado, Listado de Morosos.

## Checklist de Implementación
### Frontend
- [ ] Visualizador de reportes paginado.

---

### RF-REP-002: Exportaciones Masivas
- **Módulo**: Reportes (REP)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Interoperabilidad B2B.
- **Alcance funcional**: Todos los datatables y listados del sistema deben contar con botón "Exportar a Excel/CSV".

## Checklist de Implementación
### Backend
- [ ] Generador de streams CSV rápidos.

---

### RF-REP-003: Reportes Históricos (BI Transaccional)
- **Módulo**: Reportes (REP)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Analítica de decisiones gerenciales.
- **Alcance funcional**: Análisis de Rentabilidad por línea, Ranking de Vendedores, Comparativa interanual de Ventas.

## Checklist de Implementación
### Base de Datos / Persistencia
- [ ] Crear vistas materializadas diarias/mensuales (Data Warehouse lite) para evitar lentitud.

---

### RF-AUD-001: Trazabilidad Universal de Modificaciones (Logs)
- **Módulo**: Auditoría (AUD)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Saber quién rompió qué.
- **Alcance funcional**: Hook global que guarda el before/after (diff) de todo UPDATE o DELETE en entidades core.

## Checklist de Implementación
### Backend
- [ ] Implementación de `spatie/laravel-activitylog` o similar en Eloquent/ORM equivalente.

---

### RF-AUD-002: Auditoría de Accesos
- **Módulo**: Auditoría (AUD)
- **Etapa**: Enterprise
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Seguridad.
- **Alcance funcional**: Log de IP, User-Agent y Timestamp de cada Login exitoso y fallido.

## Checklist de Implementación
### Backend
- [ ] Interceptor en el endpoint de autenticación.

---

### RF-NOT-001: Motor Centralizado de Notificaciones
- **Módulo**: Notificaciones (NOT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Alertas del ERP a los operadores.
- **Alcance funcional**: Entidad Notification. Push interno (campanita UI) o envío de Email transaccional.

## Checklist de Implementación
### Backend
- [ ] Cola de trabajos (Jobs Queue) para despachar correos asíncronamente sin bloquear requests HTTP.

---

### RF-NOT-002: Gestión de Suscripciones por Área
- **Módulo**: Notificaciones (NOT)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Reducir ruido.
- **Alcance funcional**: Permitir a los usuarios tildar qué notificaciones quieren (Ej: Solo avisarme si se rechaza un pago).

## Checklist de Implementación
### Frontend
- [ ] Pantalla "Mis Preferencias".

---

### RF-INT-001: Motor de Integración Contable y Fiscal Externa
- **Módulo**: Integraciones (INT)
- **Etapa**: MVP
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Cumplir leyes.
- **Alcance funcional**: Conector para enviar facturas electrónicas vía WebService al ente recaudador (AFIP, SII, SAT).

## Checklist de Implementación
### Integraciones
- [ ] Cliente SOAP/REST homologado con certificado digital para Autorización (CAE).
### QA
- [ ] Ambiente de Homologación habilitado.

---

### RF-INT-002: Integración de Plataformas de Cobro Online
- **Módulo**: Integraciones (INT)
- **Etapa**: Crecimiento
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Modernizar B2B.
- **Alcance funcional**: Enviar link de pago a cliente, y al recibir el Webhook, generar el Recibo automáticamente.

## Checklist de Implementación
### Backend
- [ ] Endpoint de recolección de Webhooks, securizado.

---

### RF-INT-003: Conectores y Mensajería (API Pública)
- **Módulo**: Integraciones (INT)
- **Etapa**: Enterprise
- **Estado de implementación**: [ ] Pendiente
- **Objetivo**: Extensibilidad.
- **Alcance funcional**: Exponer un subconjunto de APIs seguras mediante API Keys para que aplicaciones de terceros (E-Commerce B2B externo) puedan consultar stock y enviar pedidos.

## Checklist de Implementación
### Backend
- [ ] Autenticación por Bearer Token no atada a Usuarios físicos sino a `ApiClients`.
### Definition of Done
- [ ] Rate limits implementados.


