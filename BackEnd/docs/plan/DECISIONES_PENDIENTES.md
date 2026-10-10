# Decisiones pendientes del plan backend

**Verificado:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c`. Las entradas de esta lista no contradicen los ADRs aprobados: delimitan huecos que los ADRs nombran pero no resuelven.

## D-01 — Facturación y origen del débito

- **Pregunta:** ¿qué documento y qué flujo fiscal generan la factura que habilita el débito de cuenta corriente?
- **Opciones:** factura interna no fiscal primero y factura electrónica fiscal después; integración fiscal desde el primer release; o un documento comercial intermedio con un adaptador fiscal posterior.
- **Evidencia:** `BackEnd/docs/adr/ADR-BE-010-cuenta-corriente-caja.md` §Cuenta corriente y objeción 1 aceptan que no haya débitos hasta que exista Facturación; `FrontEnd/docs/historial/auditorias/backend/06_COBERTURA_RF.md` RF-FAC-001..004 no tiene contrato; `BackEnd/docs/README.md` fila BE-9 la marca como prerrequisito.
- **Qué bloquea:** BE-09, `ClientAccount`/ledger, numeración fiscal, exposición de crédito y RF-FAC/RF-CCT.
- **Recomendación:** documentar un ADR de Facturación antes de BE-09, empezando por factura interna no fiscal y dejando explícita la frontera fiscal; no se elige en esta sesión.

## D-02 — Alta de empresas en producción

- **Pregunta:** ¿quién crea una empresa, sus sucursales, roles iniciales y primer administrador cuando todavía no existe tenant?
- **Opciones:** operador de plataforma sin tenant; job de provisioning con credencial de plataforma; alta manual fuera de la API.
- **Evidencia:** `BackEnd/docs/README.md:110` y `FrontEnd/docs/ESTADO.md:64` dicen que `db:seed-dev` solo cubre desarrollo; `BackEnd/docs/adr/ADR-BE-002-tenancy-rls.md` fija el tenant desde la sesión y no describe la primera escritura sin tenant.
- **Qué bloquea:** onboarding productivo, credenciales iniciales, auditoría de la primera operación y el límite operativo de las funciones `SECURITY DEFINER`.
- **Recomendación:** ADR de provisioning separado, con actor de plataforma, permisos y trazabilidad explícitos; no se elige en esta sesión.

## D-03 — Precio por producto dentro de una lista

- **Pregunta:** ¿una lista de precios mantiene solo un porcentaje sobre el precio base o precios por producto/versiones vigentes?
- **Opciones:** porcentaje sobre precio base (alcance BE-03..BE-10); tabla de precios por producto y moneda; ambas, con precio específico que sobrescribe el porcentaje.
- **Evidencia:** `BackEnd/docs/adr/ADR-BE-006-dinero-numeracion.md` y `BackEnd/docs/README.md:101` fijan para BE-0..10 una lista como porcentaje; `FrontEnd/docs/PENDIENTES.md:154-177` dice que la UI de listas existe como feature futura sin tipo real; RF-PRI-001..003 de `06_COBERTURA_RF.md` no tienen contrato.
- **Qué bloquea:** precio resuelto de BE-05, seed y formularios de listas, descuentos por línea y evolución posterior de precios.
- **Recomendación:** mantener el alcance mínimo de porcentaje para cerrar BE-03 y abrir un ADR antes de precios por producto; no se decide aquí.

## D-04 — Preparación y Despacho como entidades

- **Pregunta:** ¿Preparación/Despacho son entidades persistidas o la preparación queda derivada de entregas y el despacho es una transición logística?
- **Opciones:** entidades `Preparation`/`Dispatch`; preparación derivada y entrega con líneas como documento operativo; modelo híbrido con preparación solo cuando hay faltantes.
- **Evidencia:** `BackEnd/docs/adr/ADR-BE-008-cumplimiento-parcial.md` §Preparación dice que “en preparación” es derivado y no hay acción manual; `FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md:82-87` conserva la pregunta por RF-PRE-001..004; `06_COBERTURA_RF.md` no tiene endpoints RF-PRE.
- **Qué bloquea:** BE-06, RF-PRE, picking, faltantes, backorder y la semántica de despacho.
- **Recomendación:** comparar el costo de la entidad contra el flujo decidido de Delivery con líneas; no convertir la recomendación en contrato sin ADR.

## D-05 — Dirección efectiva del pedido

- **Pregunta:** ¿el snapshot del pedido toma dirección fiscal, dirección de entrega del cliente o los campos capturados en `OrderDeliverySection`?
- **Opciones:** fiscal; entrega del cliente cuando `deliveryAddressSameAsFiscal` es falso; snapshot explícito capturado en el alta, con fallback documentado.
- **Evidencia:** `FrontEnd/docs/PENDIENTES.md:297-303` verifica que hoy se guardan campos de UI pero el pedido usa `selectedClient.address`; `FrontEnd/docs/adr/ADR-007-alertas.md` no cubre esta decisión; `BackEnd/docs/adr/ADR-BE-007-pedido.md` fija snapshot comercial pero no esta elección de origen.
- **Qué bloquea:** BE-05 y las direcciones de Delivery/remito de BE-06.
- **Recomendación:** resolver junto con el contrato de alta de pedido y congelar un único snapshot; no se elige aquí.

## D-06 — Recepción parcial de compras

- **Pregunta:** ¿la recepción se modela como cantidades por línea, remito de compra o partición de la orden?
- **Opciones:** `cantidadRecibida` y estado parcial; documento de recepción append-only; partición de OC en documentos hijos.
- **Evidencia:** `FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md:89-96`; `BackEnd/docs/adr/ADR-BE-008-cumplimiento-parcial.md` §Compra deja simetría abierta; `03_REGLAS_DE_NEGOCIO.md` R-CMP-6 y R-CMP-7 muestran que hoy `received` solo cambia estado.
- **Qué bloquea:** BE-08, ingreso de stock de BE-04 y numeración REC.
- **Recomendación:** elegir una unidad transaccional que permita cantidades y stock sin duplicar movimientos; no se decide aquí.

## D-07 — Producto sin registro de stock

- **Pregunta:** ¿un producto sin fila de stock en una sucursal se muestra como cero o como “stock no configurado”?
- **Opciones:** mantener la proyección actual como cero; mostrar un estado distinto; crear filas de stock al alta del producto para todas las sucursales.
- **Evidencia:** `FrontEnd/docs/PENDIENTES.md:231-270` describe `inv-019`, el criterio E5 y el costo de cambiar `getLowStockPage`; `02_MODELO_DE_DATOS.md:109-110` separa catálogo empresa y stock sucursal.
- **Qué bloquea:** semántica de BE-04, KPIs de bajo stock y la futura inicialización de inventario.
- **Recomendación:** decidir antes de cerrar el contrato de stock; no se cambia el check ni el mock desde documentación.

## D-08 — Datos demo y referencias de BE-2

- **Pregunta:** ¿se migra el mock completo a los UUID fijos de BE-2 en la misma tanda o se mantiene un adaptador de ids hasta que cada módulo se conecte?
- **Opciones:** migración integral; adaptadores por módulo; doble catálogo temporal con traducción explícita.
- **Evidencia:** `origin/sesion-be2-2026-10-10:b1aedf5` contiene UUIDs fijos y `AUDIT_2026-10-10_be2-referencias.md` documenta referencias futuras; `FrontEnd/src/data/mock/suppliers.data.ts`, `vehicles.data.ts`, `drivers.data.ts` en `lean` usan ids legacy.
- **Qué bloquea:** arrastre frontend de BE-02, referencias de viajes/OC/inventario y el modo mixto.
- **Recomendación:** preferir una única migración por módulo, con mappers que no oculten referencias faltantes; la decisión de secuencia queda abierta.

## D-09 — Operación y producción

- **Pregunta:** ¿qué proveedor, entornos y controles operativos se usarán para desplegar y ejecutar jobs/storage del backend?
- **Opciones:** Supabase/Postgres + object storage S3-compatible administrado; infraestructura propia; combinación por entorno.
- **Evidencia:** `BackEnd/docs/adr/ADR-BE-001-stack-repositorio.md` y `ADR-BE-011-exportacion-alertas-tablero.md` fijan Postgres obligatorio hasta BE-6 y una interfaz de storage desde BE-7, pero no fijan deploy, CI, migraciones productivas, backups, logs, monitoreo, rate limits, proveedor concreto, jobs con varias instancias ni login nativo; `BackEnd/docs/SETUP_SUPABASE.md` solo cubre setup local/roles.
- **Qué bloquea:** BE-07 (storage), BE-10 (jobs/export/alertas) y los gates de producción.
- **Recomendación:** ADR operativo con entornos, secretos, migraciones, observabilidad, locks/jobs, límites y recuperación; no se elige aquí.

## Contradicciones que requieren atención

No se modificaron ADRs ni código. La auditoría de 2026-10-07 describe un frontend sin backend, pero `lean=e719e96` ya tiene BE-0a..BE-1c; la diferencia es de estado histórico y se corrige en el cierre documental. El inventario viejo de `02_MODELO_DE_DATOS.md` llama “sucursal” al destino de una OC, mientras ADR-BE-002/README fijan orden de compra como EMPRESA con sucursal obligatoria: se conserva la distinción y la spec BE-08 no la presenta como una decisión nueva.
