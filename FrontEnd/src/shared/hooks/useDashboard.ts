import type { DashboardData } from '../types/dashboard.types';
import { fetchDashboardData } from '@/services/mock/dashboard.service';
import { useCachedQuery, CACHE_STALE_TIME } from './useCachedQuery';

// ============================================================
// useDashboard — Datos del Dashboard, via useCachedQuery (Tanda 2.5,
// ver RELEVAMIENTO_CACHE.md/DECISIONES_TECNICAS.md). staleTime
// DERIVED (2 min): es un agregado calculado, sin ninguna mutacion en
// el proyecto que lo invalide explicitamente todavia (ver la tabla de
// invalidacion, DECISIONES_TECNICAS.md — nada apunta a esta key hoy).
// ============================================================

interface UseDashboardReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardReturn {
  const { data, isLoading, error, refetch } = useCachedQuery(
    'dashboard',
    undefined,
    (signal) => fetchDashboardData(signal),
    { staleTime: CACHE_STALE_TIME.DERIVED }
  );

  return { data: data ?? null, isLoading, error, refetch };
}
