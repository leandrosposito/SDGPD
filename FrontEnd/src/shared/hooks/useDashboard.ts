import { useState, useEffect } from 'react';
import type { DashboardData } from '../types/dashboard.types';
import { fetchDashboardData } from '@/services/mock/dashboard.service';

// ============================================================
// useDashboard — Custom hook for dashboard data fetching
// Manages loading, error, and data state.
// ============================================================

interface UseDashboardReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchDashboardData();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError('No se pudo cargar la informacion del dashboard.');
          console.error('[useDashboard]', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  return { data, isLoading, error, refetch };
}
