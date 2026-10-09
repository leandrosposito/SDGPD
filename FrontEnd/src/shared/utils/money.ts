import type { Currency } from '@/shared/types/client.types';

// ============================================================
// money — Modulo unico de dinero (ADR-008, Tanda 7 de la corrida
// completa). Entero en la unidad minima (centavos), nunca `number` de
// punto flotante para plata — ver AUDIT_10_DINERO_CANTIDADES.md
// hallazgo ALTO #1.
//
// ALCANCE DE ESTA TANDA (no expandir): `Money` se usa SOLO en los
// agregados NUEVOS del tablero (dashboardAggregates.service.ts) — los
// tipos de dominio existentes (Order.totalAmount, CashTransaction.*,
// ClientAccount.*, AgingBucketAggregate.totalOverdue, etc.) siguen en
// `number` tal como estan hoy. Migrarlos a `Money` es una migracion de
// dominio completa (tocaria cada service/mapper/componente que ya los
// usa), fuera de alcance de esta tanda — ver `moneyFromNumber` mas
// abajo, que es el puente temporal para consumir esos campos desde el
// tablero sin migrar el dominio entero.
// ============================================================

export interface Money {
  readonly centavos: number;
  readonly moneda: Currency;
}

export class MoneyCurrencyMismatchError extends Error {
  constructor(a: Currency, b: Currency) {
    super(`No se pueden sumar montos de distinta moneda: ${a} y ${b}.`);
    this.name = 'MoneyCurrencyMismatchError';
  }
}

export function money(centavos: number, moneda: Currency): Money {
  return { centavos: Math.round(centavos), moneda };
}

// Suma dos Money de la MISMA moneda — nunca colapsa monedas distintas
// en un numero inventado (mismo criterio que OverdueAmountByCurrency,
// AUDIT_10 "que esta bien"). Falla explicito si no coinciden, igual
// que los constructores de branded types de ids.types.ts (Tanda 5).
export function sumMoney(a: Money, b: Money): Money {
  if (a.moneda !== b.moneda) throw new MoneyCurrencyMismatchError(a.moneda, b.moneda);
  return money(a.centavos + b.centavos, a.moneda);
}

// Redondeo: al centavo mas cercano, mitad hacia arriba (Math.round) —
// UNICO punto de redondeo de todo el modulo, documentado como pide
// ADR-008 ("el redondeo ocurre en un solo lugar"). `factor` no tiene
// por que ser entero (ej. una cantidad fraccionable o un porcentaje de
// descuento) — el redondeo final siempre cae en centavos enteros.
export function multiplyMoney(m: Money, factor: number): Money {
  return money(m.centavos * factor, m.moneda);
}

// Puente temporal: convierte un `number` de un campo de dominio que
// TODAVIA no migro a Money (ej. AgingBucketAggregate.totalOverdue) a
// Money, para que el tablero pueda mostrarlo con el modulo nuevo sin
// esperar la migracion completa del dominio. `value` se asume en la
// unidad PRINCIPAL de la moneda (ej. 1234.5 = $1234,50), como son hoy
// todos los campos monetarios `number` del proyecto.
export function moneyFromNumber(value: number, moneda: Currency): Money {
  return money(value * 100, moneda);
}

export function formatMoney(m: Money): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: m.moneda }).format(m.centavos / 100);
}

// Unidad principal -> centavos SIN redondear, desplazando la coma en
// base 10 (notacion exponencial) en vez de multiplicar en binario:
// 1.005 * 100 da 100.49999999999999 (Math.round -> 100, mal), mientras
// que Number('1.005e2') da 100.5 (Math.round -> 101, half-up). El
// redondeo sigue ocurriendo solo en money(). Tanda 22: lo usa
// parseMoneyInput; moneyFromNumber conserva `value * 100` (tiene un
// consumidor en dashboard, ver el reporte de la Tanda 22).
function principalToUnroundedCentavos(value: number): number {
  const [mantissa, exponent = '0'] = String(value).split('e');
  return Number(`${mantissa}e${Number(exponent) + 2}`);
}

// Parseo desde un input de formulario (string del DOM) — coercion +
// validacion explicita, mismo criterio que los 2 schemas Zod ya
// migrados (ProductFormModal/PurchaseOrderFormModal, AUDIT_9). Lanza
// si el string no es un numero valido (vacio, solo espacios, no
// numerico, o no finito como "Infinity"), nunca devuelve NaN en
// silencio. El valor se lee en la unidad principal, igual que
// moneyFromNumber, y se redondea half-up al centavo.
export function parseMoneyInput(raw: string, moneda: Currency): Money {
  const parsed = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(parsed)) {
    throw new Error(`Monto invalido: "${raw}" no es un numero.`);
  }
  return money(principalToUnroundedCentavos(parsed), moneda);
}
