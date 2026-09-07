import type { Alert, AlertSeverity, AlertsSummary, AlertType } from '@/shared/types/alert.types';
import { ALERTS_MOCK_DATA } from '@/data/mock/alerts.data';
import { httpClient } from '@/shared/api/httpClient';
import { paginateAlertsByCursor, type AlertsPageQuery, type AlertsPageResult } from './alertsCursor';

export type { AlertsPageQuery, AlertsPageResult };

// ============================================================
// alerts.service — ADR-007 (Tanda 7 de la corrida completa). Dos
// endpoints, nunca uno solo: /alerts/summary (contadores, para el
// badge) y /alerts (detalle paginado por CURSOR — primer endpoint del
// proyecto que pagina asi, ver AUDIT_3_PAGINACION_VOLUMEN.md hallazgo
// MEDIO #3: los 13 listados existentes usan offset por razones
// historicas que esta consulta nueva no arrastra). La logica de
// paginacion por cursor en si vive en alertsCursor.ts (pura, sin
// httpClient) — ver ese archivo para el esquema de cursor elegido.
// ============================================================

let alertsStore: Alert[] = structuredClone(ALERTS_MOCK_DATA);

function countByTipo(alerts: readonly Alert[]): Record<AlertType, number> {
  const counts: Record<AlertType, number> = { 'transferencia-retrasada': 0, 'producto-por-vencer': 0 };
  for (const alert of alerts) counts[alert.tipo] += 1;
  return counts;
}

function countBySeveridad(alerts: readonly Alert[]): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = { baja: 0, media: 0, alta: 0 };
  for (const alert of alerts) counts[alert.severidad] += 1;
  return counts;
}

// Nunca trae todas las alertas al cliente para este calculo (ADR-007,
// alternativa descartada #1) — se calcula sobre el store interno.
// porTipo/porSeveridad describen el desglose de las NO LEIDAS (lo que
// el badge necesita: "cuantas sin leer hay de cada tipo/severidad"),
// no el total historico de alertas.
export async function getAlertsSummary(empresaId: string, signal?: AbortSignal): Promise<AlertsSummary> {
  return httpClient.request<AlertsSummary>({
    method: 'GET',
    path: '/alerts/summary',
    params: { empresaId },
    signal,
    mock: () => {
      const unread = alertsStore.filter((a) => !a.leida);
      return {
        totalNoLeidas: unread.length,
        porTipo: countByTipo(unread),
        porSeveridad: countBySeveridad(unread),
      };
    },
  });
}

export async function getAlertsPage(
  empresaId: string,
  query: AlertsPageQuery = {},
  signal?: AbortSignal
): Promise<AlertsPageResult> {
  return httpClient.request<AlertsPageResult>({
    method: 'GET',
    path: '/alerts',
    params: { empresaId, cursor: query.cursor ?? undefined, tipo: query.tipo, severidad: query.severidad, pageSize: query.pageSize },
    signal,
    mock: () => {
      const result = paginateAlertsByCursor(alertsStore, query);
      return { items: structuredClone(result.items), nextCursor: result.nextCursor };
    },
  });
}

// Marca leida, nunca borra (ADR-007) — append-only en espiritu: el
// registro sigue existiendo, solo cambia su flag de lectura.
export async function markAlertAsRead(empresaId: string, alertId: string): Promise<void> {
  await httpClient.request<void>({
    method: 'PUT',
    path: `/alerts/${alertId}/read`,
    params: { empresaId },
    mock: () => {
      alertsStore = alertsStore.map((a) => (a.id === alertId ? { ...a, leida: true } : a));
    },
  });
}
