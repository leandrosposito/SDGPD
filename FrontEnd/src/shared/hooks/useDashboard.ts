import type { DashboardData } from '../types/dashboard.types';
import { fetchDashboardData } from '@/services/mock/dashboard.service';
import { useCachedQuery, CACHE_STALE_TIME } from './useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';

// ============================================================
// useDashboard — Datos del Dashboard, via useCachedQuery (Tanda 2.5,
// ver RELEVAMIENTO_CACHE.md/DECISIONES_TECNICAS.md). staleTime
// DERIVED (2 min): es un agregado calculado, sin ninguna mutacion en
// el proyecto que lo invalide explicitamente todavia (ver la tabla de
// invalidacion, DECISIONES_TECNICAS.md — nada apunta a esta key hoy).
//
// empresaId explicito (AUDIT_2026-09-08_empresaId-sweep.md, Lote 5):
// fetchDashboardData no lo recibia — regla 3.5 del protocolo ("toda
// funcion de service lleva empresaId explicito"). useCachedQuery ya
// deriva empresaId internamente para la query key y para `enabled`
// (no dispara sin sesion cargada) — ese mecanismo no cambia, esto
// ademas pasa el valor real a la funcion que arma el request.
// ============================================================

interface UseDashboardReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardReturn {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const { data, isLoading, error, refetch } = useCachedQuery(
    'dashboard',
    undefined,
    (signal) => fetchDashboardData(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.DERIVED, enabled: Boolean(empresaId) }
  );

  return { data: data ?? null, isLoading, error, refetch };
}
