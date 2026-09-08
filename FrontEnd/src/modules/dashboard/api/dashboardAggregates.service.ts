import { httpClient } from '@/shared/api/httpClient';
import { getOrdersSnapshotForAggregation } from '@/modules/orders/api/orders.service';
import { getOverdueClientsPage } from '@/modules/clients/api/clients.service';
import { getOrderBranchLinksForAggregation } from '@/modules/logistics/services/deliveries.service';
import { moneyFromNumber, type Money } from '@/shared/utils/money';
import type { Currency } from '@/shared/types/client.types';
import type { BranchId } from '@/shared/types/ids.types';
import {
  groupSalesByZone,
  groupOrdersByStatusInRange,
  filterOrdersForBranch,
  type SalesByZoneRow,
  type OrdersByStatusRow,
} from './dashboardAggregates';

export type { SalesByZoneRow, OrdersByStatusRow };

// ============================================================
// dashboardAggregates.service — Tanda 7 de la corrida completa;
// ADR-009 agrega el filtro OPCIONAL por sucursal. Agregados del
// tablero, ya calculados server-side (nunca llega al componente la
// coleccion cruda de pedidos/clientes). Pasa por httpClient igual que
// el resto de los services (Tanda 2.5).
//
// ALCANCE (ver dashboardAggregates.ts para el detalle de "por zona, no
// por sucursal", y ADR-009 para el filtro por sucursal via Delivery):
// esto NO reemplaza src/services/mock/dashboard.service.ts (KPIs/
// grafico de ventas/top productos/pedidos recientes existentes, sin
// cambios) — son secciones NUEVAS del tablero, al lado de las viejas.
// ============================================================

export interface DashboardAggregatesResult {
  salesByZone: SalesByZoneRow[];
  ordersByStatus: OrdersByStatusRow[];
}

export interface DashboardAggregatesQuery {
  dateFrom?: string;
  dateTo?: string;
  // ADR-009: ausente = toda la empresa. Presente = solo pedidos con al
  // menos una Delivery de esa sucursal (Order no tiene branchId
  // propio, ver dashboardAggregates.ts#filterOrdersForBranch).
  branchId?: BranchId;
}

export async function getDashboardAggregates(
  empresaId: string,
  query: DashboardAggregatesQuery,
  signal?: AbortSignal
): Promise<DashboardAggregatesResult> {
  return httpClient.request<DashboardAggregatesResult>({
    method: 'GET',
    path: '/dashboard/aggregates',
    params: { empresaId, dateFrom: query.dateFrom, dateTo: query.dateTo, branchId: query.branchId },
    signal,
    mock: () => {
      const snapshot = getOrdersSnapshotForAggregation();
      const scoped = query.branchId
        ? filterOrdersForBranch(snapshot, getOrderBranchLinksForAggregation(), query.branchId)
        : snapshot;
      return {
        salesByZone: groupSalesByZone(scoped),
        ordersByStatus: groupOrdersByStatusInRange(scoped, query.dateFrom, query.dateTo),
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
//
// ADR-009: `branchId` se acepta por consistencia de firma con
// getDashboardAggregates (misma forma de contrato en los 2 endpoints
// agregados del dashboard) pero se IGNORA en el calculo — ClientAccount/
// facturas no tienen ninguna relacion con sucursal en el modelo, ni
// directa ni via Delivery (una entrega no es lo mismo que una factura
// vencida). Esta tarjeta queda EMPRESA-ONLY siempre, decision explicita
// de ADR-009, no un olvido. La UI debe mostrarlo como tal.
//
// empresaId SI es obligatorio y SI se usa (regla 3.5 del protocolo,
// AUDIT_2026-09-08_empresaId-sweep.md): antes esta funcion no podia
// recibirlo porque getOverdueClientsPage tampoco lo aceptaba en sus
// filtros — se corrigio de raiz junto con clients.service.ts en el
// mismo lote.
export async function getOverdueTotalsInMoney(
  empresaId: string,
  branchId?: BranchId,
  signal?: AbortSignal
): Promise<Money[]> {
  void branchId; // ver comentario arriba: aceptado por contrato, no usado.
  const page = await getOverdueClientsPage({ page: 1, pageSize: 1, filters: { empresaId } }, signal);
  const byBucket = page.aggregates?.byBucket ?? [];

  const totalsByCurrency = new Map<Currency, number>();
  for (const bucket of byBucket) {
    totalsByCurrency.set(bucket.currency, (totalsByCurrency.get(bucket.currency) ?? 0) + bucket.totalOverdue);
  }

  return [...totalsByCurrency.entries()].map(([currency, total]) => moneyFromNumber(total, currency));
}
