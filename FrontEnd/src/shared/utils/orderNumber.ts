// ============================================================
// orderNumber — Formato/parseo puro del numero de pedido correlativo
// (Tanda 11, ADR-014). Extraido de orders.service.ts para poder
// ejercitarse con un smoke script puro (node, sin import.meta.env) —
// mismo criterio que shared/utils/tripCapacity.ts. La parte con
// estado (el Map<empresaId, number> y el store de pedidos) se queda en
// orders.service.ts — esto es solo la aritmetica/formato, sin efectos.
// ============================================================

const ORDER_NUMBER_PATTERN = /^PED-(\d+)$/;

export function extractOrderNumberSuffix(orderNumber: string): number | null {
  const match = ORDER_NUMBER_PATTERN.exec(orderNumber);
  return match ? Number(match[1]) : null;
}

export function maxOrderNumberSuffix(orderNumbers: string[]): number {
  return orderNumbers.reduce((max, on) => Math.max(max, extractOrderNumberSuffix(on) ?? 0), 0);
}

export function formatOrderNumber(n: number, digits: number): string {
  return `PED-${String(n).padStart(digits, '0')}`;
}
