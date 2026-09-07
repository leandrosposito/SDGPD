# ADR-008 — Dinero y cantidades

**Estado:** Decidido (resuelve la pregunta abierta #1 de `AUDIT_10_DINERO_CANTIDADES.md`). **Fecha:** 2026-09-07.

## Problema

`AUDIT_10_DINERO_CANTIDADES.md` confirmó que **cero** campos monetarios del proyecto usan otra representación que `number` de JS (punto flotante), sin unidad mínima definida ni política de redondeo — riesgo real de arrastre de error a escala (hallazgo ALTO #1), agravado por al menos un cálculo ya encadenado sin redondeo de negocio (`OrderTotalsSection`, hallazgo ALTO #2).

## Opción elegida

- **Entero en la unidad mínima (centavos), nunca `number` de punto flotante para plata.** Un tipo `Money` con la moneda explícita: `{ centavos: number; moneda: Currency }` (o equivalente — `centavos` como entero, `Number.isInteger` verificable, nunca resultado directo de una multiplicación de floats sin pasar por el módulo de abajo).
- **Un único módulo en `shared/`** (ej. `shared/utils/money.ts`) para: sumar dos `Money` (misma moneda, error explícito si no coinciden — mismo criterio que `OverdueAmountByCurrency` ya aplica, `AUDIT_10` "qué está bien"), multiplicar un `Money` por una cantidad entera, formatear para mostrar (reemplaza las 19 implementaciones locales de `formatCurrency` ya identificadas en A10 hallazgo BAJO #5), y parsear desde un input de formulario (string del DOM → `Money`, coercionado y validado, mismo criterio que Zod ya aplica en los 2 formularios migrados). **Ningún componente hace aritmética de dinero por su cuenta** — ni un `precio * cantidad` inline en un JSX, ni un `.reduce` de importes fuera de este módulo.
- **El redondeo ocurre en un solo lugar, documentado en el propio módulo** — política explícita (ej. "redondear al centavo más cercano, mitad hacia arriba") en vez de la ausencia actual de cualquier política (A10 hallazgo #2: hoy solo se redondea al mostrar, nunca antes de persistir).
- **Los totales de un listado o de un período los calcula el servidor**, nunca el cliente — coherente con la Sección 7 del prompt maestro y con lo que Compras ya hace bien (`computePurchaseOrderTotal`, nunca persiste un total propio). Lo único que el cliente calcula es la **previsualización de un formulario todavía abierto** (ej. el total que se ve mientras se cargan líneas de un pedido nuevo, antes de guardar) — y ese cálculo va marcado explícitamente como previsualización (un comentario o un tipo distinto, ej. `PreviewTotal` vs. `Total`), nunca se persiste como si fuera la fuente de verdad.
- **Cantidades: enteras**, salvo que la unidad de medida sea fraccionable (ej. kg, litros) — en ese caso, misma técnica: entero en la unidad mínima de esa medida (ej. gramos en vez de kg), nunca un `number` fraccionario directo.

## Alternativas descartadas

1. **Decimal como string, con una librería de precisión arbitraria (`decimal.js` o similar) para los cálculos.** Descartada porque el prompt maestro prohíbe instalar dependencias nuevas (Sección 2) — sería la alternativa técnicamente más flexible (soporta cualquier cantidad de decimales sin el límite de un entero de 53 bits seguros), pero no es viable sin una dependencia nueva. Si en el futuro se levanta esa restricción, vale la pena reconsiderar para monedas con más de 2 decimales o cálculos de interés compuesto.
2. **Seguir con `number` de punto flotante, agregando solo redondeo al final.** Descartada porque no resuelve el problema de fondo (A10 hallazgo #1) — el redondeo al mostrar ya existía y no evitó el hallazgo #2 (cálculo de IVA encadenado sin redondeo de negocio); un `number` sigue siendo impreciso para sumas repetidas (saldos de cuenta corriente que se acumulan operación a operación).
3. **`bigint` en vez de `number` entero para los centavos.** Descartada por sobre-ingeniería para el rango de magnitudes de este dominio (un ERP de PyMEs, no transacciones de escala que exijan más de 53 bits de precisión entera) — `number` entero (hasta `Number.MAX_SAFE_INTEGER`, ~9 billones de centavos = ~90 mil millones de la unidad principal) alcanza con margen.
4. **Que cada componente siga calculando su propio total, pero redondeando localmente.** Descartada — no resuelve la duplicación (A10 hallazgo #5, 19 implementaciones de formato) ni el riesgo de que dos componentes redondeen distinto para el mismo dato.

## Qué se rompe si se cambia después

- Migrar de `number` en centavos a decimal-string más adelante exige tocar cada tipo de dominio con un campo `Money` y cada punto que lo construye/lee — el propio módulo centralizado (`shared/utils/money.ts`) acota el costo: si toda la aritmética pasa por ahí, cambiar la representación interna es un cambio de un archivo, no de N call-sites.
- Si un componente nuevo hace `precio * cantidad` directo sin pasar por el módulo (reintroduciendo el patrón que A10 hallazgo #3 ya señaló repetido 4 veces), se pierde la garantía de redondeo consistente que este ADR establece.
- Si la previsualización de un formulario abierto deja de marcarse explícitamente como tal y se empieza a tratar como fuente de verdad, se reintroduce el riesgo que A10 hallazgo #3 ya señaló en `orders` (persistir un total calculado en cliente sin re-derivarlo server-side).
