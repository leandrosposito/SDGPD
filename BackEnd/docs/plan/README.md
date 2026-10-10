# Plan ejecutable del backend

**Verificado:** 2026-10-10 contra `lean=e719e96c870244bc67756f3fa91f929315ef761c` y el filesystem de hoy. Esta carpeta convierte la auditoría de backend y los ADRs aprobados en consignas ejecutables. No reemplaza a los ADRs: cada spec cita la sub-decisión aplicable y describe su efecto.

## Cómo arrancar una sesión

1. Leer `FrontEnd/docs/PROTOCOLO.md`, `BackEnd/CLAUDE.md` y este índice.
2. Confirmar la rama base y ejecutar la unidad indicada, por ejemplo: **“Leé PROTOCOLO.md y ejecutá `BackEnd/docs/plan/BE-03-productos-clientes-precios.md`”**.
3. Leer la spec completa, los ADRs enlazados, `TRAZABILIDAD.md` y `DECISIONES_PENDIENTES.md`. La spec es la fuente operativa; el ADR sigue siendo la fuente de la decisión.
4. Implementar en una rama desde `lean`, respetar la frontera de dependencias y dejar los tests/checklist/gates de la spec.
5. Ejecutar `npm run docs:check -w @sdgpd/backend -- BE-0N` antes de cerrar la unidad. El verificador lee los universos desde las fuentes, no desde una lista duplicada.

No se implementa una decisión marcada `[ABIERTO D-nn]`: se documenta el bloqueo y se actualiza la spec luego de resolverla mediante ADR o instrucción explícita. Los nombres y ejemplos marcados `[PROPUESTO]` no son contrato.

## Estado y orden

| Unidad | Estado al 2026-10-10 | Spec | Dependencias |
|---|---|---|---|
| BE-02 | **en curso** en `origin/sesion-be2-2026-10-10` (`b1aedf5`) | [BE-02-maestros](BE-02-maestros.md) | BE-1b mergeada; cierre pendiente |
| BE-03 | lista para implementar **cuando BE-2 se mergee** | [BE-03-productos-clientes-precios](BE-03-productos-clientes-precios.md) | BE-02 |
| BE-04 | lista para implementar **cuando BE-3 se mergee** | [BE-04-inventario](BE-04-inventario.md) | BE-03 |
| BE-05 | bloqueada por BE-03 y BE-04 | [BE-05-pedidos](BE-05-pedidos.md) | BE-03, BE-04 |
| BE-06 | bloqueada por BE-05/BE-04; RF-PRE queda en D-04 | [BE-06-entregas-remitos](BE-06-entregas-remitos.md) | BE-05, BE-04; D-04 solo para Preparación |
| BE-07 | bloqueada por BE-06 y D-09 | [BE-07-viajes-pod-storage](BE-07-viajes-pod-storage.md) | BE-06, storage operativo |
| BE-08 | bloqueada por BE-02, BE-03, BE-04 y D-06 | [BE-08-compras-recepciones](BE-08-compras-recepciones.md) | maestros, productos, inventario |
| BE-09 | bloqueada por BE-04, D-01 y D-06 | [BE-09-caja-cuenta-facturacion](BE-09-caja-cuenta-facturacion.md) | inventario, Facturación |
| BE-10 | bloqueada parcialmente por D-09 | [BE-10-export-alertas-analitica](BE-10-export-alertas-analitica.md) | contratos y jobs operativos |

## Grafo de dependencias

`BE-0a → BE-0b → BE-1a → BE-1b → BE-2 → BE-3 → BE-4 → BE-5 → BE-6 → BE-7`.

Desde BE-3, la rama de compras es `BE-2 → BE-3 → BE-4 → BE-8`. La rama financiera es `BE-3 → BE-4 → D-01 → BE-9`. BE-10 consume proyecciones de las tandas anteriores y decisiones de operación. La Facturación no se inventa dentro de BE-9: es D-01 y prerrequisito de sus débitos.

## BE-2 al retomar la rama en curso

Lo primero es **mergear `lean` dentro de `sesion-be2-2026-10-10`**. Esta sesión de documentación toca `FrontEnd/docs/ESTADO.md`, `BackEnd/docs/README.md`, `BackEnd/CLAUDE.md` y `CLAUDE.md`; habrá conflictos chicos de texto. No se debe hacer checkout de la rama de BE-2 para esta sesión, ni modificarla. La evidencia de lo existente en ella se consulta con `git diff lean...origin/sesion-be2-2026-10-10`, `git show origin/sesion-be2-2026-10-10:<ruta>` y `git cat-file -e`.

La rama contiene contratos, tablas, RLS, endpoints, seed y una extensión de aislamiento de los cuatro maestros, pero el commit `b1aedf5` declara WIP: faltan tests de endpoints, suites de contratos, lint, build, checklist, conexión del frontend, documentación y gates. Ver [BE-02-maestros](BE-02-maestros.md).

## Fuentes y reglas de lectura

- Universos: `FrontEnd/docs/historial/auditorias/backend/00_RESUMEN.md`, `01_ENDPOINTS.md`, `02_MODELO_DE_DATOS.md`, `03_REGLAS_DE_NEGOCIO.md`, `06_COBERTURA_RF.md`, y los ítems vigentes relacionados con backend de `FrontEnd/docs/PENDIENTES.md`.
- Decisiones: `BackEnd/docs/adr/ADR-BE-001..011` y sus secciones **Objeciones**, más `FrontEnd/docs/adr/ADR-001`, `004`, `005`, `006`, `007`, `008`, `009`, `010`, `011`, `013`, `014`, `015` y `016` cuando la spec los cita.
- Negocio: solo los extractos `.md`/`.txt` de `Documentacion/negocio/`, especialmente Documento 04, `doc02_all_extracted.txt` y `doc03_extracted.txt`.
- Auditoría posterior: `FrontEnd/docs/historial/auditorias/AUDIT_2026-10-10_be2-referencias.md` vive en la rama de BE-2; se consulta desde esa rama sin copiar referencias no verificadas en `lean`.

## Herramientas

- `npm run docs:check -w @sdgpd/backend`: comprueba el plan completo.
- `npm run docs:check -w @sdgpd/backend -- BE-02`: comprueba una spec.
- `npm run docs:check -w @sdgpd/backend -- --init`: reconstruye la tabla de trazabilidad desde las fuentes actuales; después hay que revisar destinos y evidencia.

Los destinos completos y las decisiones abiertas están en [TRAZABILIDAD.md](TRAZABILIDAD.md) y [DECISIONES_PENDIENTES.md](DECISIONES_PENDIENTES.md). La lista de trabajo que no entra en BE-02..BE-10 está en [FUERA_DE_PLAN.md](FUERA_DE_PLAN.md); la deuda de lo ya construido está en [DEUDA.md](DEUDA.md).
