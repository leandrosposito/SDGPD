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
//
// empresaId explicito en fetchDashboardData (AUDIT_2026-09-08_empresaId-sweep.md,
// Lote 5 — regla 3.5 del protocolo). El mock sigue siendo de una sola
// empresa (no filtra DASHBOARD_MOCK_DATA por empresaId), mismo
// criterio ya establecido en el resto del proyecto: el parametro se
// acepta y viaja en el contrato, el mock no necesita aplicarlo porque
// no hay mas de una empresa que simular todavia.
//
// fetchKpis/fetchSalesSeries/fetchTopProducts/fetchRecentOrders (abajo)
// son codigo muerto — 0 consumidores fuera de este archivo, confirmado
// por grep. No se les agrega empresaId (arreglarle la firma a algo que
// nadie llama no tiene sentido) ni se borran (el protocolo prohibe
// borrar codigo aparentemente muerto sin decision explicita) — quedan
// tal cual, listadas en el informe de esta sesion.
// ============================================================

export async function fetchDashboardData(empresaId: string, signal?: AbortSignal): Promise<DashboardData> {
  return httpClient.request<DashboardData>({
    method: 'GET',
    path: '/dashboard',
    params: { empresaId },
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
