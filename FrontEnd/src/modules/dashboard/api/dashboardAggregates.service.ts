import { httpClient } from '@/shared/api/httpClient';
import { getOrdersSnapshotForAggregation } from '@/modules/orders/api/orders.service';
import { getOverdueClientsPage } from '@/modules/clients/api/clients.service';
import { moneyFromNumber, type Money } from '@/shared/utils/money';
import type { Currency } from '@/shared/types/client.types';
import { groupSalesByZone, groupOrdersByStatusInRange, type SalesByZoneRow, type OrdersByStatusRow } from './dashboardAggregates';

export type { SalesByZoneRow, OrdersByStatusRow };

// ============================================================
// dashboardAggregates.service — Tanda 7 de la corrida completa.
// Agregados NUEVOS del tablero, ya calculados server-side (nunca
// llega al componente la coleccion cruda de pedidos/clientes). Pasa
// por httpClient igual que el resto de los services (Tanda 2.5).
//
// ALCANCE (ver dashboardAggregates.ts para el detalle de "por zona, no
// por sucursal"): esto NO reemplaza src/services/mock/dashboard.service.ts
// (KPIs/grafico de ventas/top productos/pedidos recientes existentes,
// sin cambios) — son secciones NUEVAS del tablero, al lado de las
// viejas.
// ============================================================

export interface DashboardAggregatesResult {
  salesByZone: SalesByZoneRow[];
  ordersByStatus: OrdersByStatusRow[];
}

export interface DashboardAggregatesQuery {
  dateFrom?: string;
  dateTo?: string;
}

export async function getDashboardAggregates(
  empresaId: string,
  query: DashboardAggregatesQuery,
  signal?: AbortSignal
): Promise<DashboardAggregatesResult> {
  return httpClient.request<DashboardAggregatesResult>({
    method: 'GET',
    path: '/dashboard/aggregates',
    params: { empresaId, dateFrom: query.dateFrom, dateTo: query.dateTo },
    signal,
    mock: () => {
      const snapshot = getOrdersSnapshotForAggregation();
      return {
        salesByZone: groupSalesByZone(snapshot),
        ordersByStatus: groupOrdersByStatusInRange(snapshot, query.dateFrom, query.dateTo),
      };
    },
  });
}

// Cuentas por cobrar vencidas, envueltas en Money (ADR-008) — reusa
// getOverdueClientsPage#aggregates.byBucket, que YA calcula esto
// server-side (clients.service.ts, sin tocar). Pide pageSize=1 porque
// solo interesan los agregados, no el detalle paginado (ese ya tiene
// su propia pantalla, Clientes Morosos). Suma los tramos de aging POR
// MONEDA (nunca entre monedas distintas, mismo criterio que
// OverdueAmountByCurrency) usando moneyFromNumber como puente temporal
// mientras AgingBucketAggregate siga en `number` (fuera de alcance de
// esta tanda migrarlo).
export async function getOverdueTotalsInMoney(signal?: AbortSignal): Promise<Money[]> {
  const page = await getOverdueClientsPage({ page: 1, pageSize: 1, filters: {} }, signal);
  const byBucket = page.aggregates?.byBucket ?? [];

  const totalsByCurrency = new Map<Currency, number>();
  for (const bucket of byBucket) {
    totalsByCurrency.set(bucket.currency, (totalsByCurrency.get(bucket.currency) ?? 0) + bucket.totalOverdue);
  }

  return [...totalsByCurrency.entries()].map(([currency, total]) => moneyFromNumber(total, currency));
}
