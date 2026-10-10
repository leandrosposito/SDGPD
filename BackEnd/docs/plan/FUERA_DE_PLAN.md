# Fuera de plan BE-02..BE-10

**Verificado:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`, Documento 04 y los 11 ADRs backend. “Fuera de plan” significa que ninguna de las specs BE-02..BE-10 entrega el alcance completo; no significa que el RF sea descartable.

## RF sin tanda completa

| Módulo / RF | Motivo | Qué haría falta |
|---|---|---|
| Organización: RF-ORG-001..004 | Alta de empresa, parámetros y datos fiscales no forman parte de BE-02..10. | Resolver D-02, crear ADR de provisioning y un módulo de plataforma; parámetros de empresa deben tener contrato y RLS/actor de plataforma. |
| IAM: RF-IAM-003..004 | Estado completo de usuario y autenticación nativa no son una tanda nueva: el backend web está en BE-1a/1b; nativo responde 501. | Si se requiere app nativa, ampliar contrato de login y checklist; no mezclarlo con maestros. |
| Catálogo: RF-CAT-001 | Categorías reales no tienen entidad ni ADR dentro del plan. | ADR de catálogo, tabla de categorías, alcance y conexión de `TabCategories`. |
| Productos: RF-PRD-003..004 | Conversión de unidades y capacidades de catálogo no están cerradas en ADR-BE-006. | ADR de unidades/conversión y su impacto en stock, compras y cantidades. |
| Precios: RF-PRI-002..003 | El plan cubre listas como porcentaje sobre precio base; precio por producto y descuento por línea quedan en D-03. | ADR de precios por producto, vigencia, moneda y descuento; luego extender BE-03/BE-05. |
| Inventario: RF-INV-004 | “Transferencia retrasada” no tiene entidad de transferencia; la alerta actual apunta a Delivery. | ADR de transferencias entre sucursales y una tanda posterior a BE-04/BE-06. |
| Compras: RF-CMP-003, RF-CMP-005..006 | Requisición/aprobación, proveedores alternativos y capacidades avanzadas no aparecen en la secuencia aprobada. | ADR de requisiciones y compras avanzadas; extender BE-08. |
| Ventas: RF-VEN-001..004 | No hay módulo de facturación/ventas separado en BE-02..10; el pedido comercial se cubre en BE-05. | ADR de Ventas/Facturación y su integración con D-01. |
| Preparación: RF-PRE-001..004 | ADR-BE-008 difiere estas entidades y deja “en preparación” como derivado. | Resolver D-04; si se eligen entidades, abrir tanda posterior o ampliar BE-06 con alcance explícito. |
| Facturación: RF-FAC-001..004 | Sin ADR propio; prerrequisito de BE-09. | D-01, ADR de Facturación, contrato de factura interna/fiscal, numeración y conectores. |
| Finanzas: RF-FIN-001..002 | Finanzas corporativas no son caja ni cuenta corriente de BE-09. | ADR y módulo de finanzas/contabilidad. |
| Reportes: RF-REP-003 | BE-10 cubre analítica SQL indicada por ADR-BE-011, pero reportes de crecimiento requieren definición de métricas y permisos. | Completar catálogo de métricas y una tanda posterior si el alcance excede analítica. |
| Auditoría: RF-AUD-002 | BE-0b/1a cubren auditoría técnica de mutaciones, no retención/exportación enterprise. | ADR de retención, búsqueda, acceso y export de auditoría. |
| Notificaciones: RF-NOT-002 | BE-10 cubre alertas internas, no canales externos. | ADR de email/push/webhook, preferencias y proveedor. |
| Integraciones: RF-INT-001..003 | No hay proveedor ni contrato decidido. | ADR por integración, secretos, reintentos, webhooks y jobs. |

## Operación y producción

Los ADRs vigentes sí fijan decisiones parciales:

- `[DECIDIDO]` Postgres es la infraestructura obligatoria hasta BE-6; desde BE-7 se agrega una interfaz de object storage, disco local en desarrollo y S3-compatible en producción (`ADR-BE-001`, `ADR-BE-011`).
- `[DECIDIDO]` las migraciones son SQL versionadas con runner propio; `drizzle-kit push` está prohibido (`ADR-BE-001`).
- `[DECIDIDO]` jobs de exportación/alertas son server-side e idempotentes; el storage de archivos no es Postgres (`ADR-BE-011`).

No están definidos y se registran como D-09:

- deploy y promoción entre desarrollo, staging y producción;
- CI, gates remotos y política de rollback;
- migraciones en producción, aprobación, backup/restore y retención;
- secretos, rotación y separación por entorno;
- logs estructurados, trazas, métricas, alertas y monitoreo;
- límites de tasa, cuotas por empresa y protección de exports/search;
- proveedor concreto del object storage, lifecycle y antivirus;
- jobs con más de una instancia, scheduler/lease y recuperación después de un crash;
- login nativo, que hoy responde 501 por decisión de BE-1a pero no tiene aplicación consumidora.

## Mantenimiento

Si un RF de esta lista recibe un ADR nuevo, no se debe mover silenciosamente a una spec existente: agregar la decisión a `DECISIONES_PENDIENTES.md`, actualizar `TRAZABILIDAD.md` y crear o ampliar una tanda con criterios de aceptación propios.
