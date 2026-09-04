import type { DashboardData } from '@/shared/types/dashboard.types';
import { DASHBOARD_MOCK_DATA } from '@/data/mock/dashboard.data';
import { httpClient } from '@/shared/api/httpClient';

// ============================================================
// DASHBOARD SERVICE — pasa por httpClient (Tanda 2.5 de
// escalabilidad, ver DECISIONES_TECNICAS.md): timeout, reintentos,
// cancelacion real y VITE_MOCK_LATENCY_MS/VITE_MOCK_FAILURE_RATE/
// VITE_API_DEBUG ya no son exclusivos de suppliers.service.ts. Sigue
// devolviendo la misma forma de datos que antes (sin DTO/mapper —
// eso es Tanda 3): solo cambio el mecanismo de transporte.
// ============================================================

export async function fetchDashboardData(signal?: AbortSignal): Promise<DashboardData> {
  return httpClient.request<DashboardData>({
    method: 'GET',
    path: '/dashboard',
    signal,
    mock: () => structuredClone(DASHBOARD_MOCK_DATA),
  });
}

export async function fetchKpis() {
  return httpClient.request({
    method: 'GET',
    path: '/dashboard/kpis',
    mock: () => structuredClone(DASHBOARD_MOCK_DATA.kpis),
  });
}

export async function fetchSalesSeries() {
  return httpClient.request({
    method: 'GET',
    path: '/dashboard/sales-series',
    mock: () => structuredClone(DASHBOARD_MOCK_DATA.salesSeries),
  });
}

export async function fetchTopProducts() {
  return httpClient.request({
    method: 'GET',
    path: '/dashboard/top-products',
    mock: () => structuredClone(DASHBOARD_MOCK_DATA.topProducts),
  });
}

export async function fetchRecentOrders() {
  return httpClient.request({
    method: 'GET',
    path: '/dashboard/recent-orders',
    mock: () => structuredClone(DASHBOARD_MOCK_DATA.recentOrders),
  });
}
