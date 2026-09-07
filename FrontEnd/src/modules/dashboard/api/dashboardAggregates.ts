import type { OrderStatus } from '@/shared/types/order.types';
import type { OrderId, BranchId } from '@/shared/types/ids.types';

// ============================================================
// dashboardAggregates — funciones PURAS de agrupacion para el tablero
// (Tanda 7 de la corrida completa; ADR-009 agrega el filtro por
// sucursal). Deliberadamente sin ningun import de httpClient/React:
// httpClient.ts lee `import.meta.env` a nivel de modulo, que no existe
// fuera de Vite — este archivo tiene que poder importarse desde un
// smoke script corrido con `node` puro (ver scripts/smoke/tanda-7.smoke.mjs
// y scripts/smoke/adr-009.smoke.mjs), asi que no puede arrastrar esa
// cadena de imports. Los imports de `ids.types.ts` son solo de tipo
// (`import type`), se borran en compilacion — no rompen esa garantia.
// `dashboardAggregates.service.ts` es la capa async/httpClient que
// llama a estas funciones sobre datos reales.
//
// Las funciones reciben una PROYECCION minima de Order (no el DTO ni
// el tipo de dominio completo) para no acoplar esta logica pura a la
// forma exacta de esos otros modulos.
// ============================================================

export interface OrderProjectionForAggregation {
  id: OrderId;
  status: OrderStatus;
  date: string; // ISO, se compara por el prefijo yyyy-MM-dd (dia calendario)
  zone: string;
  totalAmount: number;
}

// ADR-009: un pedido "pertenece" a una sucursal si existe al menos una
// Delivery con ese orderId y ese branchId — Order no tiene branchId
// propio (alcance EMPRESA, ya cerrado), asi que el filtro por
// sucursal se resuelve via la relacion real con Delivery, no con un
// campo inventado. Un pedido con entregas en mas de una sucursal
// (reintentos/redespacho) cuenta para cada una — es lo honesto.
export function filterOrdersForBranch<T extends { id: OrderId }>(
  orders: readonly T[],
  links: readonly { orderId: OrderId; branchId: BranchId }[],
  branchId: BranchId
): T[] {
  const orderIdsInBranch = new Set(links.filter((l) => l.branchId === branchId).map((l) => l.orderId));
  return orders.filter((o) => orderIdsInBranch.has(o.id));
}

export interface SalesByZoneRow {
  zone: string;
  totalVentas: number;
  cantidadPedidos: number;
}

// Ventas por ZONA (no "por sucursal" — Order no tiene branchId hoy,
// es alcance EMPRESA, confirmado en AUDIT_5_SCOPE_EMPRESA_SUCURSAL.md
// "que esta bien". Agrupar por sucursal exigiria agregar branchId a
// Order, cambio de modelo de datos fuera de alcance de esta tanda —
// se agrupa por `zone`, el dato geografico real que Order SI tiene).
// Excluye pedidos cancelados (mismo criterio que
// orders.service.ts#computeAggregates para "facturacion_hoy": un
// pedido cancelado no es una venta real).
export function groupSalesByZone(orders: readonly OrderProjectionForAggregation[]): SalesByZoneRow[] {
  const byZone = new Map<string, SalesByZoneRow>();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const existing = byZone.get(order.zone);
    if (existing) {
      existing.totalVentas += order.totalAmount;
      existing.cantidadPedidos += 1;
    } else {
      byZone.set(order.zone, { zone: order.zone, totalVentas: order.totalAmount, cantidadPedidos: 1 });
    }
  }
  return [...byZone.values()].sort((a, b) => b.totalVentas - a.totalVentas);
}

export interface OrdersByStatusRow {
  status: OrderStatus;
  cantidad: number;
}

// Pedidos del periodo [dateFrom, dateTo] (inclusive, ambos opcionales)
// agrupados por estado. Comparacion de fecha por STRING yyyy-MM-dd
// (nunca `new Date()` sin normalizar) — mismo criterio ya usado en
// clients.service.ts#isWithinDateRange, ver AUDIT_11_FECHAS_ZONA_HORARIA.md.
export function groupOrdersByStatusInRange(
  orders: readonly Pick<OrderProjectionForAggregation, 'status' | 'date'>[],
  dateFrom?: string,
  dateTo?: string
): OrdersByStatusRow[] {
  const counts = new Map<OrderStatus, number>();
  for (const order of orders) {
    const day = order.date.slice(0, 10);
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([status, cantidad]) => ({ status, cantidad }));
}
