// ============================================================
// Smoke script — Tanda 7 (corrida completa): Money (ADR-008), cursor
// de alertas (ADR-007), agrupacion de pedidos por zona/estado-periodo.
// Ejercita las funciones PURAS de cada modulo (sin httpClient, que
// lee import.meta.env y no corre con `node` puro) importando el
// codigo real, no una copia — un cambio real en esos archivos rompe
// este script en vez de quedar desincronizado en silencio.
//
// Correr con: node scripts/smoke/tanda-7.smoke.mjs (desde FrontEnd/).
// ============================================================

import { money, sumMoney, multiplyMoney, moneyFromNumber, formatMoney, parseMoneyInput, MoneyCurrencyMismatchError } from '../../src/shared/utils/money.ts';
import { paginateAlertsByCursor, sortAlertsByRecency } from '../../src/shared/api/alerts/alertsCursor.ts';
import { groupSalesByZone, groupOrdersByStatusInRange } from '../../src/modules/dashboard/api/dashboardAggregates.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

function throws(fn, errorClass) {
  try {
    fn();
    return false;
  } catch (err) {
    return errorClass ? err instanceof errorClass : true;
  }
}

// ------------------------------------------------------------
// 1. Money (ADR-008)
// ------------------------------------------------------------
const a = money(1050, 'ARS'); // $10,50
const b = money(250, 'ARS'); // $2,50
const sum = sumMoney(a, b);
check('sumMoney suma centavos de la misma moneda', sum.centavos === 1300 && sum.moneda === 'ARS');

check(
  'sumMoney lanza MoneyCurrencyMismatchError si las monedas difieren',
  throws(() => sumMoney(money(100, 'ARS'), money(100, 'USD')), MoneyCurrencyMismatchError)
);

// 3.33 centavos deberia redondear a 3 (no truncar a 3.33 ni quedar en float)
const multiplied = multiplyMoney(money(100, 'ARS'), 0.0333);
check('multiplyMoney redondea al centavo entero (100 * 0.0333 = 3.33 -> 3)', multiplied.centavos === 3);

const fromNumber = moneyFromNumber(1234.5, 'ARS');
check('moneyFromNumber convierte $1234,50 a 123450 centavos', fromNumber.centavos === 123450);
check('formatMoney formatea sin lanzar', typeof formatMoney(fromNumber) === 'string' && formatMoney(fromNumber).length > 0);

// parseMoneyInput (Tanda 22). Esperados tomados del contrato, no de lo
// que la funcion devuelve hoy:
// - header de parseMoneyInput (money.ts): "Lanza si el string no es un
//   numero valido, nunca devuelve NaN en silencio"; "mismo criterio que
//   los 2 schemas Zod" = z.coerce.number() sobre <input type="number">,
//   cuyo valor DOM es decimal con punto y sin separador de miles.
// - moneyFromNumber: el valor esta en la unidad PRINCIPAL (1234.5 = $1234,50).
// - money()/multiplyMoney + ADR-008 (enmienda 2026-10-07): redondeo al
//   centavo mas cercano en un solo punto; desde la enmienda 2026-10-09
//   (Tanda 23) la mitad exacta se aleja del cero y Money admite negativos.
const isArsMoney = (m, centavos) => m.centavos === centavos && m.moneda === 'ARS' && Number.isInteger(m.centavos);
check('parseMoneyInput("1234") -> 123400 centavos', isArsMoney(parseMoneyInput('1234', 'ARS'), 123400));
check('parseMoneyInput("1234.567") (3 decimales) -> 123457 centavos (half-up)', isArsMoney(parseMoneyInput('1234.567', 'ARS'), 123457));
check('parseMoneyInput("1.005") (mitad exacta) -> 101 centavos (half-up, no 100 por error binario)', isArsMoney(parseMoneyInput('1.005', 'ARS'), 101));
// "Infinity" no esta en la lista de la consigna: cubre el cambio de
// Number.isNaN a Number.isFinite (Tanda 22) — un no finito nunca puede
// terminar en centavos NaN/Infinity.
for (const raw of ['', '   ', 'abc', '1234,56', '1.234,56', '0,5', '1,234.56', '12,345', '1.234.567,89', 'Infinity']) {
  check(`parseMoneyInput(${JSON.stringify(raw)}) lanza (no es un numero valido para el criterio de input type="number")`, throws(() => parseMoneyInput(raw, 'ARS')));
}

// Tanda 23 (ADR-008, enmienda 2026-10-09): negativos, redondeo simetrico
// y un solo camino de conversion (parseMoneyInput delega en moneyFromNumber).
check('parseMoneyInput("-10") -> -1000 centavos (Money admite negativos)', isArsMoney(parseMoneyInput('-10', 'ARS'), -1000));
check('parseMoneyInput("-1.005") -> -101 centavos (mitad exacta se aleja del cero)', isArsMoney(parseMoneyInput('-1.005', 'ARS'), -101));
const cancel = sumMoney(parseMoneyInput('1.005', 'ARS'), parseMoneyInput('-1.005', 'ARS'));
check('sumMoney(parse("1.005"), parse("-1.005")) -> 0 centavos (un importe y su reverso se cancelan)', isArsMoney(cancel, 0) && !Object.is(cancel.centavos, -0));
check('moneyFromNumber(1.005) -> 101 centavos (desplaza la coma en base 10, no * 100)', isArsMoney(moneyFromNumber(1.005, 'ARS'), 101));
check('moneyFromNumber(8.345) -> 835 centavos (8.345 * 100 en binario da 834.49...)', isArsMoney(moneyFromNumber(8.345, 'ARS'), 835));
check('moneyFromNumber(0.1 + 0.2) -> 30 centavos', isArsMoney(moneyFromNumber(0.1 + 0.2, 'ARS'), 30));
check('moneyFromNumber(NaN) lanza', throws(() => moneyFromNumber(NaN, 'ARS')));
check('moneyFromNumber(Infinity) lanza', throws(() => moneyFromNumber(Infinity, 'ARS')));
check('multiplyMoney(-201 centavos, 0.5) = -100.5 -> -101 (mitad exacta negativa se aleja del cero)', multiplyMoney(money(-201, 'ARS'), 0.5).centavos === -101);
check('money(100.5) -> 101 y money(-100.5) -> -101 (simetrico)', money(100.5, 'ARS').centavos === 101 && money(-100.5, 'ARS').centavos === -101);

// ------------------------------------------------------------
// 2. Cursor de alertas (ADR-007) — pedir una pagina, usar el
// nextCursor para la siguiente, sin duplicados, cursor final null.
// ------------------------------------------------------------
const mockAlerts = Array.from({ length: 12 }, (_, i) => ({
  id: `alr-${String(i + 1).padStart(3, '0')}`,
  tipo: i % 2 === 0 ? 'transferencia-retrasada' : 'producto-por-vencer',
  severidad: 'media',
  creadoEn: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
  leida: false,
}));
// mas reciente = id mas alto (fecha ascendente con i) -> alr-012 es el mas nuevo

const page1 = paginateAlertsByCursor(mockAlerts, { pageSize: 5 });
check('pagina 1 devuelve 5 items empezando por el mas reciente', page1.items.length === 5 && page1.items[0].id === 'alr-012');
check('pagina 1 tiene nextCursor (hay mas)', page1.nextCursor !== null);

const page2 = paginateAlertsByCursor(mockAlerts, { pageSize: 5, cursor: page1.nextCursor });
const overlap = page2.items.some((item) => page1.items.some((prev) => prev.id === item.id));
check('pagina 2 no repite items de la pagina 1', !overlap);
check('pagina 2 tiene nextCursor (todavia hay mas: 12 - 10 = 2 restantes)', page2.nextCursor !== null);

const page3 = paginateAlertsByCursor(mockAlerts, { pageSize: 5, cursor: page2.nextCursor });
check('pagina 3 trae los ultimos 2 items', page3.items.length === 2);
check('pagina 3 tiene nextCursor null (no hay mas)', page3.nextCursor === null);

const allIds = new Set([...page1.items, ...page2.items, ...page3.items].map((i) => i.id));
check('las 3 paginas juntas cubren los 12 items sin duplicados', allIds.size === 12);

check(
  'sortAlertsByRecency ordena por creadoEn descendente',
  sortAlertsByRecency(mockAlerts)[0].id === 'alr-012'
);

// ------------------------------------------------------------
// 3. Agrupacion de pedidos por zona y por estado/periodo (Tanda 7)
// ------------------------------------------------------------
const mockOrders = [
  { status: 'delivered', date: '2026-09-01T10:00:00Z', zone: 'Norte', totalAmount: 1000 },
  { status: 'delivered', date: '2026-09-02T10:00:00Z', zone: 'Norte', totalAmount: 500 },
  { status: 'pending', date: '2026-09-03T10:00:00Z', zone: 'Sur', totalAmount: 700 },
  { status: 'cancelled', date: '2026-09-03T10:00:00Z', zone: 'Norte', totalAmount: 9999 },
  { status: 'delivered', date: '2026-08-15T10:00:00Z', zone: 'Sur', totalAmount: 300 }, // fuera de rango en el filtro de abajo
];

const salesByZone = groupSalesByZone(mockOrders);
const norte = salesByZone.find((r) => r.zone === 'Norte');
const sur = salesByZone.find((r) => r.zone === 'Sur');
check('groupSalesByZone excluye pedidos cancelados', norte.totalVentas === 1500 && norte.cantidadPedidos === 2);
check('groupSalesByZone agrupa Sur correctamente', sur.totalVentas === 1000 && sur.cantidadPedidos === 2);

const byStatusInRange = groupOrdersByStatusInRange(mockOrders, '2026-09-01', '2026-09-03');
const deliveredInRange = byStatusInRange.find((r) => r.status === 'delivered')?.cantidad ?? 0;
check('groupOrdersByStatusInRange cuenta solo fechas dentro del rango (2 delivered, no 3)', deliveredInRange === 2);
check(
  'groupOrdersByStatusInRange excluye el pedido del 2026-08-15 (fuera de rango)',
  byStatusInRange.reduce((sum, r) => sum + r.cantidad, 0) === 4
);

// ------------------------------------------------------------
if (failures > 0) {
  console.log(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
process.exit(0);
