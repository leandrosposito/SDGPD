# Documentacion/ — specs de negocio del ERP

Verificado con `ls`/`git ls-files` el 2026-09-09. Los `.docx`/`.pdf` no se pueden leer desde Claude Code (no hay parser de Word ni renderer de PDF en este entorno) — **leé `negocio/doc02_all_extracted.txt` y `negocio/doc03_extracted.txt` en su lugar**, son la única versión legible por herramientas de esos documentos (texto plano extraído, generados en la auditoría documental de agosto 2026).

## `negocio/` — vigente, en orden de derivación

1. **`01. Product Vision SDGPD.docx`/`.pdf`** — Documento 01, visión de producto. Sin extracto de texto (no cubierto por `doc02_all_extracted.txt`/`doc03_extracted.txt`).
2. **La serie `02 a` … `02 s` (+ `L`, `ñ`), 20 `.docx`** — Documento 02, "Arquitectura Funcional del Negocio (Business Domain)", capítulo por archivo (identificación, principios, actores, los 13 dominios funcionales DF-01..DF-13, etc.). Legible completo en `doc02_all_extracted.txt`.
3. **`03— Modelo Funcional del Dominio.docx`** — Documento 03, deriva del 02: comportamiento funcional (procesos, entidades, reglas, estados) de cada dominio. Legible completo en `doc03_extracted.txt`.
4. **`Documento-04-Plan-Maestro-de-Requerimientos-y-Tareas-de-Implementacion.md`** — Documento 04, backlog ejecutable derivado de 01+02+03: 83 Requerimientos Funcionales (RF-XXX-NNN), ya en texto plano, se lee directo.

## `_archivo/` — no vigente, se conserva por referencia

`Documento 02 — Arquitectura Funcional del ERP.docx`/`.pdf`: versión **anterior y distinta** del Documento 02 (estructura de 5 capas técnicas + 9 dominios, no las 13 de la serie de capítulos vigente) — no es un duplicado, es un borrador temprano que la serie `02 a`..`02 s` reemplazó en alcance. No usar para nada nuevo.

## `_historial-auditoria-doc04/` — no vigente, proceso ya cerrado

5 informes (`inventario_auditoria_doc04.md` → `informe_auditoria_cobertura.md` → `informe_calidad_doc04.md` → `dictamen_final_doc04.md` → `informe_cierre_documento_04.md`) del proceso de 4 fases que auditó y consolidó el Documento 04 en agosto 2026. Documentan cómo se armó el Documento 04, no son fuente de reglas de negocio en sí — para eso, usar `negocio/`.
