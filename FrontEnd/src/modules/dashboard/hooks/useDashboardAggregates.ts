import { useSessionStore } from '@/shared/state/useSessionStore';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import {
  getDashboardAggregates,
  getOverdueTotalsInMoney,
  type SalesByZoneRow,
  type OrdersByStatusRow,
} from '@/modules/dashboard/api/dashboardAggregates.service';
import type { Money } from '@/shared/utils/money';

// ============================================================
// useDashboardAggregates — Tanda 7 de la corrida completa. Trae, en
// una sola consulta cacheada, las 3 secciones nuevas del tablero
// (ventas por zona, pedidos por estado del periodo, cuentas por
// cobrar vencidas en Money) — las 3 se muestran siempre juntas en la
// misma seccion de la pagina, asi que comparten un solo estado de
// carga/error en vez de 3 useCachedQuery independientes.
// ============================================================

export interface DashboardAggregatesData {
  salesByZone: SalesByZoneRow[];
  ordersByStatus: OrdersByStatusRow[];
  overdueTotals: Money[];
}

interface UseDashboardAggregatesReturn {
  data: DashboardAggregatesData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardAggregates(): UseDashboardAggregatesReturn {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const { data, isLoading, error, refetch } = useCachedQuery(
    'dashboard-aggregates',
    undefined,
    async (signal) => {
      const [aggregates, overdueTotals] = await Promise.all([
        getDashboardAggregates(empresaId ?? '', {}, signal),
        getOverdueTotalsInMoney(signal),
      ]);
      return { ...aggregates, overdueTotals };
    },
    { enabled: Boolean(empresaId), staleTime: CACHE_STALE_TIME.DERIVED }
  );

  return { data: data ?? null, isLoading, error, refetch };
}
