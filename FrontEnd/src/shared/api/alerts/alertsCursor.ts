import type { Alert, AlertSeverity, AlertType } from '@/shared/types/alert.types';

// ============================================================
// alertsCursor — logica PURA de paginacion por cursor de alertas
// (Tanda 7 de la corrida completa, ADR-007). Separado de
// alerts.service.ts (que importa httpClient, y httpClient.ts lee
// `import.meta.env` a nivel de modulo — no existe fuera de Vite) para
// que el smoke script pueda ejercitar esta logica con `node` puro, sin
// arrastrar esa cadena de imports. Mismo criterio ya aplicado en
// dashboardAggregates.ts (Tanda 7) y useUrlListState.ts (Tanda 4).
//
// Esquema de cursor: el `id` del ULTIMO item devuelto en la pagina
// anterior. Se ordena SIEMPRE por creadoEn desc (mas reciente primero,
// id como desempate estable), se busca la posicion de ese id en la
// lista ya filtrada+ordenada, y se devuelven los `pageSize` siguientes
// a partir de ahi. Si el cursor no aparece (cambio de filtro entre
// paginas, o la alerta referenciada ya no matchea), se interpreta como
// "sin cursor" y arranca desde el principio — nunca lanza, es un
// cursor opaco que el cliente solo reenvia, no construye a mano.
// ============================================================

export interface AlertsPageQuery {
  cursor?: string | null;
  tipo?: AlertType;
  severidad?: AlertSeverity;
  pageSize?: number;
}

export interface AlertsPageResult {
  items: Alert[];
  nextCursor: string | null;
}

export const DEFAULT_ALERTS_PAGE_SIZE = 5;

export function sortAlertsByRecency(alerts: readonly Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const byDate = b.creadoEn.localeCompare(a.creadoEn);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

export function paginateAlertsByCursor(alerts: readonly Alert[], query: AlertsPageQuery): AlertsPageResult {
  const { cursor, tipo, severidad, pageSize = DEFAULT_ALERTS_PAGE_SIZE } = query;

  const filtered = sortAlertsByRecency(alerts).filter(
    (a) => (!tipo || a.tipo === tipo) && (!severidad || a.severidad === severidad)
  );

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = filtered.findIndex((a) => a.id === cursor);
    startIndex = cursorIndex === -1 ? 0 : cursorIndex + 1;
  }

  const items = filtered.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < filtered.length;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}
