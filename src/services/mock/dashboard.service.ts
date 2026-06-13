import type { DashboardData } from '../../types/dashboard.types';
import { DASHBOARD_MOCK_DATA } from '../../data/mock/dashboard.data';

// ============================================================
// DASHBOARD SERVICE — Simulates async API calls
// Replace these implementations with real fetch/axios calls
// when the backend API is available.
// ============================================================

const SIMULATED_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDashboardData(): Promise<DashboardData> {
  await delay(SIMULATED_DELAY_MS);
  return structuredClone(DASHBOARD_MOCK_DATA);
}

export async function fetchKpis() {
  await delay(400);
  return structuredClone(DASHBOARD_MOCK_DATA.kpis);
}

export async function fetchSalesSeries() {
  await delay(600);
  return structuredClone(DASHBOARD_MOCK_DATA.salesSeries);
}

export async function fetchTopProducts() {
  await delay(700);
  return structuredClone(DASHBOARD_MOCK_DATA.topProducts);
}

export async function fetchRecentOrders() {
  await delay(500);
  return structuredClone(DASHBOARD_MOCK_DATA.recentOrders);
}
