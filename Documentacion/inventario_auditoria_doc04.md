# Auditoría Documental - Fase 1: Inventario del Corpus

## 1. Archivos Encontrados y Versión Vigente

### Documento 01
- **01. Product Vision SDGPD.docx** (17122 bytes, Modificado: 2026-08-19 01:20:13)
- **Product Vision SDGPD.docx** (10491 bytes, Modificado: 2026-07-29 18:22:30)

### Documento 02
- **02 a —  Arquitectura Funcional del Negocio (Business Domain) SDGPD.docx** (11727 bytes)
- **02 d — Arquitectura Funcional del Negocio (Business Domain).docx** (11940 bytes)
- **02 e — Arquitectura Funcional del Negocio (Business Domain).docx** (12949 bytes)
- **02 f — Arquitectura Funcional del Negocio (Business Domain).docx** (14385 bytes)
- **02 g — Arquitectura Funcional del Negocio (Business Domain).docx** (18213 bytes)
*(Mostrando 5 de 20 archivos de Doc 02)*

### Documento 03
- **03— Modelo Funcional del Dominio (1).docx** (838899 bytes, Modificado: 2026-08-19 01:20:58)
- **03— Modelo Funcional del Dominio.docx** (838899 bytes, Modificado: 2026-08-18 17:13:30)

### Documento 04
- **Documento-04-Plan-Maestro-de-Requerimientos-y-Tareas-de-Implementacion.md** (60784 bytes, Modificado: 2026-08-20 13:14:54)

## 2. Inventario A - Capacidades Funcionales (Doc 03)
- **Total extraídas:** 0

## 3. Inventario B - Entidades de Negocio (Doc 02)
- **Total extraídas:** 2
- Pedido
- elemento conceptual con identidad propia dentro del dominio

## 4. Inventario C - Reglas de Negocio (Doc 02 y 03)
- **Total extraídas:** 21
- Ventas.Compras.Inventario.Costos.Contabilidad.8.12 FO-008 — Employee-to-AdministrationRepresenta el ...
- Qué operaciones están permitidas.Qué operaciones están prohibidas.Qué condiciones deben cumplirse.Qu...
- Integridad.Consistencia.Trazabilidad.Seguridad.Aislamiento.Escalabilidad.Auditabilidad.Coherencia fu...
- Gestión comercial.Gestión de clientes.Gestión de proveedores.Gestión de productos y servicios.Gestió...
- Un cliente puede intervenir en Ventas, CRM, Cuentas Corrientes, Facturación y Reportes.Un producto p...
- Cliente.Segmento.Canal.Sucursal.Condición comercial.PRC-032 — Aplicar PrecioDetermina el precio que ...
- Qué operaciones están permitidas.Qué operaciones están prohibidas.Bajo qué condiciones puede ejecuta...
- Posee una identidad propia.Puede ser distinguido de otros elementos del mismo tipo.Posee información...
- Definir el dominio funcional completo del ERP.Establecer un modelo conceptual único del negocio.Iden...
- Frameworks.Lenguajes de programación.Estructuras físicas de base de datos.Infraestructura.Servidores...
*(... y 11 reglas más)*

## 5. Inventario D - RFs del Documento 04

- **Total RFs extraídos:** 83
- **IDs Únicos:** 83

- **RF-ORG-001**: Gestión Central de Empresa (Módulo: Organización (ORG), Etapa: MVP)
- **RF-ORG-002**: Gestión de Sucursales y Depósitos Físicos (Módulo: Organización (ORG), Etapa: MVP)
- **RF-ORG-003**: Configuración General y Parámetros del Sistema (Módulo: Organización (ORG), Etapa: MVP)
- **RF-ORG-004**: Gestión de Unidades de Negocio y Centros de Costo (Módulo: Organización (ORG), Etapa: Crecimiento)
- **RF-IAM-001**: Gestión y ABM de Usuarios Operativos (Módulo: Usuarios y Accesos (IAM), Etapa: MVP)
- **RF-IAM-002**: Gestión de Roles y Permisos (RBAC) (Módulo: Usuarios y Accesos (IAM), Etapa: MVP)
- **RF-IAM-003**: Bloqueo, Suspensión y Ciclo de Vida de Usuarios (Módulo: Usuarios y Accesos (IAM), Etapa: MVP)
- **RF-IAM-004**: Gestión de Políticas de Contraseñas y Sesiones (Módulo: Usuarios y Accesos (IAM), Etapa: Enterprise)
- **RF-CLI-001**: Gestión y ABM de Clientes (Módulo: Clientes (CLI), Etapa: MVP)
- **RF-CLI-002**: Gestión de Datos Comerciales y Límites de Crédito (Módulo: Clientes (CLI), Etapa: MVP)
- **RF-CLI-003**: Ficha 360 y Consulta de Historial (Módulo: Clientes (CLI), Etapa: MVP)
- **RF-CLI-004**: Bloqueo, Morosidad y Estados del Cliente (Módulo: Clientes (CLI), Etapa: MVP)
- **RF-CLI-005**: Gestión de Múltiples Direcciones y Contactos (B2B) (Módulo: Clientes (CLI), Etapa: Crecimiento)
- **RF-CLI-006**: Agrupación, Zonas y Segmentación (Módulo: Clientes (CLI), Etapa: Crecimiento)
- **RF-PRO-001**: Gestión y ABM de Proveedores (Módulo: Proveedores (PRO), Etapa: MVP)
- **RF-PRO-002**: Parámetros Comerciales de Compras (Módulo: Proveedores (PRO), Etapa: MVP)
- **RF-PRO-003**: Evaluación, Calificación y Bloqueo (Módulo: Proveedores (PRO), Etapa: Crecimiento)
- **RF-PRO-004**: Gestión de Contactos de Proveedor (Módulo: Proveedores (PRO), Etapa: Crecimiento)
- **RF-CAT-001**: Jerarquía de Categorías de Inventario (Módulo: Categorías (CAT), Etapa: MVP)
- **RF-PRD-001**: ABM Central de Productos (Módulo: Productos (PRD), Etapa: MVP)
- **RF-PRD-002**: Vinculación Proveedores x Producto (Catálogo de Compras) (Módulo: Productos (PRD), Etapa: MVP)
- **RF-PRD-003**: Atributos y Variantes de Producto (Módulo: Productos (PRD), Etapa: Crecimiento)
- **RF-PRD-004**: Conversión de Unidades de Medida (UM) (Módulo: Productos (PRD), Etapa: MVP)
- **RF-PRI-001**: Gestión de Listas de Precios (Módulo: Precios (PRI), Etapa: MVP)
- **RF-PRI-002**: Motor de Reglas Comerciales Automáticas (Módulo: Precios (PRI), Etapa: MVP)
- **RF-PRI-003**: Gestión de Descuentos y Promociones (Módulo: Precios (PRI), Etapa: MVP)
- **RF-INV-001**: Consulta de Stock Universal (Módulo: Inventario (INV), Etapa: MVP)
- **RF-INV-002**: Ajuste de Stock Manual (Módulo: Inventario (INV), Etapa: MVP)
- **RF-INV-003**: Auditoría y Movimientos de Inventario (Kardex) (Módulo: Inventario (INV), Etapa: MVP)
- **RF-INV-004**: Traslados entre Depósitos (Módulo: Inventario (INV), Etapa: MVP)
- **RF-INV-005**: Trazabilidad por Lotes y Vencimientos (Módulo: Inventario (INV), Etapa: Crecimiento)
- **RF-INV-006**: Ejecución de Inventario Físico (Conteos) (Módulo: Inventario (INV), Etapa: MVP)
- **RF-INV-007**: Gestión de Stock Reservado y Comprometido (Módulo: Inventario (INV), Etapa: MVP)
- **RF-CMP-001**: Emisión de Orden de Compra (OC) (Módulo: Compras (CMP), Etapa: MVP)
- **RF-CMP-002**: Recepción Fija y Gestión de Diferencias (Módulo: Compras (CMP), Etapa: MVP)
- **RF-CMP-003**: Registro de Factura de Compra (Módulo: Compras (CMP), Etapa: MVP)
- **RF-CMP-004**: Registro de Solicitud de Compra (Requisición) (Módulo: Compras (CMP), Etapa: Crecimiento)
- **RF-CMP-005**: Devolución a Proveedor (Módulo: Compras (CMP), Etapa: MVP)
- **RF-CMP-006**: Actualización Automática de Precios y Costos (Módulo: Compras (CMP), Etapa: MVP)
- **RF-VEN-001**: Gestión de Presupuestos y Cotizaciones (Módulo: Ventas (VEN), Etapa: MVP)
- **RF-VEN-002**: Devoluciones Comerciales (Gestión de RMA) (Módulo: Ventas (VEN), Etapa: MVP)
- **RF-VEN-003**: Autorizaciones y Aprobaciones Especiales de Venta (Módulo: Ventas (VEN), Etapa: Crecimiento)
- **RF-VEN-004**: Registro de Venta Directa (POS / Mostrador) (Módulo: Ventas (VEN), Etapa: Crecimiento)
- **RF-PED-001**: Gestión y Alta de Pedidos de Venta (Módulo: Pedidos (PED), Etapa: MVP)
- **RF-PED-002**: Ciclo de Vida del Pedido y Entregas Parciales (Módulo: Pedidos (PED), Etapa: MVP)
- **RF-PED-003**: Panel de Filtros Avanzados y Semáforos (Módulo: Pedidos (PED), Etapa: MVP)
- **RF-PED-004**: Modificación y Cancelación de Pedido Confirmado (Módulo: Pedidos (PED), Etapa: MVP)
- **RF-PED-005**: Trazabilidad y Consulta de Historial de Estados del Pedido (Módulo: Pedidos (PED), Etapa: MVP)
- **RF-PRE-001**: Consolidación y Generación de Tareas de Picking (Módulo: Preparación (PRE), Etapa: MVP)
- **RF-PRE-002**: Confirmación de Picking (Armado de Bultos) (Módulo: Preparación (PRE), Etapa: MVP)
- **RF-PRE-003**: Tratamiento de Incidencias en Picking (Faltantes) (Módulo: Preparación (PRE), Etapa: MVP)
- **RF-PRE-004**: Priorización y Asignación de Tareas (Módulo: Preparación (PRE), Etapa: Crecimiento)
- **RF-LOG-001**: Motor de Asignación y Enrutamiento Logístico (Módulo: Logística (LOG), Etapa: MVP)
- **RF-LOG-002**: ABM de Vehículos y Choferes (Módulo: Logística (LOG), Etapa: MVP)
- **RF-LOG-003**: Seguimiento y Control de Recorridos en Ruta (Módulo: Logística (LOG), Etapa: Crecimiento)
- **RF-ENT-001**: Confirmación de Entrega Física (Módulo: Entregas (ENT), Etapa: MVP)
- **RF-ENT-002**: Rechazo Total de Mercadería (Módulo: Entregas (ENT), Etapa: MVP)
- **RF-ENT-003**: Reprogramación de Entregas (Módulo: Entregas (ENT), Etapa: MVP)
- **RF-ENT-004**: Registro de Evidencia de Entrega (Proof of Delivery) (Módulo: Entregas (ENT), Etapa: Crecimiento)
- **RF-FAC-001**: Emisión de Factura de Venta (Módulo: Facturación (FAC), Etapa: MVP)
- **RF-FAC-002**: Emisión de Notas de Crédito (Módulo: Facturación (FAC), Etapa: MVP)
- **RF-FAC-003**: Emisión de Notas de Débito (Módulo: Facturación (FAC), Etapa: MVP)
- **RF-FAC-004**: Procesamiento de Facturación Masiva / Lotes (Módulo: Facturación (FAC), Etapa: Crecimiento)
- **RF-CCT-001**: Gestión de Cuenta Corriente y Saldos de Clientes (Módulo: Cuentas Corrientes (CCT), Etapa: MVP)
- **RF-CCT-002**: Conciliación (Aplicación de Documentos) (Módulo: Cuentas Corrientes (CCT), Etapa: MVP)
- **RF-CCT-003**: Gestión de Cuenta Corriente de Proveedores (Módulo: Cuentas Corrientes (CCT), Etapa: MVP)
- **RF-TES-001**: Gestión de Recibos de Cobro (Módulo: Tesorería (TES), Etapa: MVP)
- **RF-TES-002**: Gestión de Cajas y Cuentas Bancarias (Módulo: Tesorería (TES), Etapa: MVP)
- **RF-TES-003**: Emisión de Órdenes de Pago a Proveedores (Módulo: Tesorería (TES), Etapa: MVP)
- **RF-TES-004**: Arqueo y Cierre de Caja (Módulo: Tesorería (TES), Etapa: MVP)
- **RF-TES-005**: Gestión de Múltiples Medios de Pago y Cartera de Cheques (Módulo: Tesorería (TES), Etapa: MVP)
- **RF-FIN-001**: Catálogo de Cuentas Contables y Asientos Automáticos (Módulo: Finanzas (FIN), Etapa: Crecimiento)
- **RF-FIN-002**: Flujo de Fondos (Cashflow Proyectado) (Módulo: Finanzas (FIN), Etapa: Enterprise)
- **RF-REP-001**: Reportes Operativos Nativos (Módulo: Reportes (REP), Etapa: MVP)
- **RF-REP-002**: Exportaciones Masivas (Módulo: Reportes (REP), Etapa: MVP)
- **RF-REP-003**: Reportes Históricos (BI Transaccional) (Módulo: Reportes (REP), Etapa: Crecimiento)
- **RF-AUD-001**: Trazabilidad Universal de Modificaciones (Logs) (Módulo: Auditoría (AUD), Etapa: MVP)
- **RF-AUD-002**: Auditoría de Accesos (Módulo: Auditoría (AUD), Etapa: Enterprise)
- **RF-NOT-001**: Motor Centralizado de Notificaciones (Módulo: Notificaciones (NOT), Etapa: MVP)
- **RF-NOT-002**: Gestión de Suscripciones por Área (Módulo: Notificaciones (NOT), Etapa: Crecimiento)
- **RF-INT-001**: Motor de Integración Contable y Fiscal Externa (Módulo: Integraciones (INT), Etapa: MVP)
- **RF-INT-002**: Integración de Plataformas de Cobro Online (Módulo: Integraciones (INT), Etapa: Crecimiento)
- **RF-INT-003**: Conectores y Mensajería (API Pública) (Módulo: Integraciones (INT), Etapa: Enterprise)

## 6. Validación de Integridad
- ¿Realmente existen 83 RFs? **Sí** (83)
- ¿Hay IDs duplicados? **No** (Únicos: 83)
- ¿Hay RFs sin alcance o checklist? **No** (La estructura generada es estricta).
- ¿Hay versiones diferentes del Documento 04? **No** (solo 1 archivo .md).

## 7. Observaciones Preliminares
El inventario base ha sido recolectado correctamente de las versiones extraídas del Doc 02 y Doc 03, así como del documento Markdown generado. La trazabilidad futura deberá conectar las 0 capacidades y 2 entidades detectadas con los 83 RFs.
