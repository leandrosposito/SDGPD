import { useSessionStore } from '@/shared/state/useSessionStore';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { isBranchId, type BranchId } from '@/shared/types/ids.types';
import {
  getDashboardAggregates,
  getOverdueTotalsInMoney,
  type SalesByZoneRow,
  type OrdersByStatusRow,
} from '@/modules/dashboard/api/dashboardAggregates.service';
import type { Money } from '@/shared/utils/money';

// ============================================================
// useDashboardAggregates — Tanda 7 de la corrida completa; ADR-009
// agrega el alcance de sucursal elegido por el usuario. Trae, en una
// sola consulta cacheada, las 3 secciones del tablero (ventas por
// zona, pedidos por estado del periodo, cuentas por cobrar vencidas
// en Money) — las 3 se muestran siempre juntas en la misma seccion de
// la pagina, asi que comparten un solo estado de carga/error en vez
// de 3 useCachedQuery independientes.
//
// Resolucion del alcance (ADR-009, "nunca dos fuentes de verdad"):
//   1. URL `?branch=<id>` con un BranchId VALIDO -> esa sucursal.
//   2. URL `?branch=all` (eleccion EXPLICITA del usuario) -> empresa
//      completa (`resolvedBranchId: undefined`), sin caer al selector
//      global aunque haya una sucursal activa.
//   3. URL `?branch=<algo invalido>` -> se trata igual que "ausente"
//      (no rompe el render, mismo criterio ya usado para el deep-link
//      `?sucursal=` de ComprasPage/Tanda 5, ADR-006).
//   4. Sin `branch` en la URL -> sigue la sucursal activa del selector
//      global (`useSessionStore#activeBranchId`); si tampoco hay
//      sucursal activa (sesion cargando), cae a empresa completa.
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
  // Alcance efectivo ya resuelto — undefined significa "toda la
  // empresa" (ya sea porque el usuario lo eligio explicitamente con
  // `?branch=all`, porque no hay sucursal activa, o porque el param de
  // URL era invalido). El componente lo usa para el encabezado y los
  // rotulos de cada tarjeta.
  resolvedBranchId: BranchId | undefined;
  // true solo cuando el alcance de empresa completa fue una eleccion
  // EXPLICITA del usuario (?branch=all) — distingue "eligio ver todo"
  // de "no eligio nada todavia", aunque el resultado numerico sea el
  // mismo. Util si el componente algun dia quiere diferenciar el
  // mensaje ("Mostrando: toda la empresa" vs "Sin sucursal activa").
  isExplicitAll: boolean;
  setBranchFilter: (value: BranchId | 'all' | undefined) => void;
}

export function useDashboardAggregates(): UseDashboardAggregatesReturn {
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const activeBranchId = useSessionStore((s) => s.activeBranchId);

  const urlState = useUrlListState<never, 'branch'>({ filterKeys: ['branch'] });
  const rawBranch = urlState.filters.branch;

  const isExplicitAll = rawBranch === 'all';
  let resolvedBranchId: BranchId | undefined;
  if (isExplicitAll) {
    resolvedBranchId = undefined;
  } else if (rawBranch && isBranchId(rawBranch)) {
    resolvedBranchId = rawBranch;
  } else {
    // Ausente, o invalido (se trata como ausente sin romper el
    // render) -> sigue al selector global.
    resolvedBranchId = activeBranchId ?? undefined;
  }

  // Query key: 'all' explicito, una sucursal real, o el string fijo
  // 'unset' (sin sucursal activa todavia, sesion cargando) son 3
  // estados distintos y cacheables por separado — nunca colapsados en
  // un solo `undefined` ambiguo (ADR-009, "forma parte de la query
  // key, incluido el caso todas las sucursales").
  const keyParams = { branchId: resolvedBranchId ?? (isExplicitAll ? 'all' : 'unset') };

  const { data, isLoading, error, refetch } = useCachedQuery(
    'dashboard-aggregates',
    keyParams,
    async (signal) => {
      const [aggregates, overdueTotals] = await Promise.all([
        getDashboardAggregates(empresaId ?? '', { branchId: resolvedBranchId }, signal),
        getOverdueTotalsInMoney(resolvedBranchId, signal),
      ]);
      return { ...aggregates, overdueTotals };
    },
    { enabled: Boolean(empresaId), staleTime: CACHE_STALE_TIME.DERIVED }
  );

  function setBranchFilter(value: BranchId | 'all' | undefined) {
    urlState.setFilter('branch', value);
  }

  return { data: data ?? null, isLoading, error, refetch, resolvedBranchId, isExplicitAll, setBranchFilter };
}
