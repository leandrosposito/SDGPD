# AUDIT 1 — Línea base de build y tipos

**Fecha:** 2026-09-06
**Commit auditado:** `cef6e15` (rama `lean`, working tree limpio — incluye Tanda 3g)

## Alcance revisado (archivos/carpetas)

Todo `FrontEnd/`: `tsc -b --force`, `npm run build`, `npm run lint`. Solo lectura/ejecución de comandos, ningún archivo de código modificado.

## Resultado tal cual está (sin corregir nada)

### `tsc -b --force`
Limpio. 0 errores, 0 warnings, sin salida.

### `npm run build` (`tsc -b && vite build`)
Limpio. 2715 módulos transformados.

```
dist/index.html                     0.71 kB │ gzip:   0.42 kB
dist/assets/index-kcuNHtJN.css    126.02 kB │ gzip:  15.91 kB
dist/assets/index-lQESRtjv.js   1,470.62 kB │ gzip: 423.05 kB
✓ built in 1.67s
```

Vite emite su warning nativo de chunk grande ("Some chunks are larger than 500 kB after minification") — no es un error, es la advertencia estándar de bundle único sin code-splitting (ver A8/A13 de esta ronda de auditorías; ya documentado antes en `docs/AUDITORIA_ESCALABILIDAD.md` D3, esa medición era 1.395,51 kB/403,34 kB gzip contra el commit `6a5610d` — el bundle creció ~75 kB / ~20 kB gzip desde entonces, consistente con el código agregado en Tandas 3d–3g).

### `npm run lint`

```
✖ 1 problem (0 errors, 1 warning)
```

Único warning: `src/modules/compras/components/PurchaseOrderFormModal.tsx:172` — `watch()` de react-hook-form incompatible con memoización del compilador de React. Preexistente, ya documentado en `docs/DECISIONES_TECNICAS.md:730` y en `docs/AUDITORIA_ESCALABILIDAD.md` E1. No introducido por este comando.

## Qué está bien (para no romperlo después)

- Los tres comandos (`tsc -b`, `vite build`, `eslint .`) corren limpios sobre el estado actual del repo — no hay deuda de tipos ni de lint acumulada que esta ronda de auditorías deba "descontar" de hallazgos posteriores.
- El único warning de lint es conocido, acotado a un archivo, y no bloquea el build ni el `tsc`.

## Esta es la línea base

Cualquier tanda de implementación posterior (Fase C) debe mantener: `tsc -b` en 0 errores, `npm run build` sin errores (el warning de chunk size es aceptado como línea base, no cuenta como regresión salvo que crezca de forma desproporcionada), `npm run lint` en 0 errores y como máximo el mismo warning preexistente. Cualquier tanda que empeore alguno de estos tres puntos respecto de lo documentado acá activa la condición de parada de la sección 7 del prompt maestro.

## Preguntas abiertas para Leandro

Ninguna — este audit es una medición mecánica, no requiere decisión.
