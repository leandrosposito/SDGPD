import { useEffect, useRef, useState, type FC } from 'react';
import { Bell, Truck, PackageX, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useQueryClient } from '@tanstack/react-query';
import { cachedQueryKey } from '@/shared/api/queryKeys';
import { getAlertsSummary, getAlertsPage, markAlertAsRead } from '@/shared/api/alerts/alerts.service';
import type { Alert } from '@/shared/types/alert.types';
import './AlertsBell.css';

// ============================================================
// AlertsBell — Campanita de alertas del layout (ADR-007, Tanda 7 de
// la corrida completa). Reemplaza el boton de notificaciones
// hardcodeado que tenia Header.tsx (badge "3" fijo, sin datos reales
// detras) por el summary/detalle real de alerts.service.ts.
//
// Paginado por CURSOR manejado localmente (no usePagedQuery, que es
// para offset — ver AlertsPageQuery/AlertsPageResult en
// alerts.service.ts): el panel arranca vacio, carga la primera pagina
// al abrirse (useEffect en el montaje del panel, que solo existe
// mientras isOpen es true), y "Cargar mas" acumula con el
// nextCursor devuelto. No se extrajo a un hook generico
// useCursorQuery porque este es hoy el UNICO consumidor de paginacion
// por cursor del proyecto — extraerlo antes de un segundo caso real
// seria una abstraccion prematura (CLAUDE.md).
// ============================================================

const PAGE_SIZE = 5;

function summaryQueryKey(empresaId: string | undefined) {
  return cachedQueryKey({ queryName: 'alerts-summary', empresaId: empresaId ?? '' });
}

function describeAlert(alert: Alert): { title: string; detail: string } {
  if (alert.tipo === 'transferencia-retrasada') {
    return {
      title: `Transferencia retrasada a ${alert.branchDestino}`,
      detail: `${alert.diasRetraso} ${alert.diasRetraso === 1 ? 'dia' : 'dias'} de retraso`,
    };
  }
  return {
    title: `${alert.productName} por vencer`,
    detail: `Vence en ${alert.diasParaVencer} ${alert.diasParaVencer === 1 ? 'dia' : 'dias'}`,
  };
}

export const AlertsBell: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data: summary } = useCachedQuery(
    'alerts-summary',
    undefined,
    (signal) => getAlertsSummary(empresaId ?? '', signal),
    { enabled: Boolean(empresaId), staleTime: CACHE_STALE_TIME.OPERATIONAL }
  );
  const unreadCount = summary?.totalNoLeidas ?? 0;

  const [items, setItems] = useState<Alert[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!empresaId) return;

    const controller = new AbortController();
    // setState se dispara desde el callback de un microtask (Promise.resolve().then),
    // nunca de forma sincronica en el cuerpo del efecto — evita el
    // cascading render que react-hooks/set-state-in-effect senala
    // sobre el patron clasico "setLoading(true); fetch()...".
    Promise.resolve()
      .then(() => {
        setIsLoading(true);
        setLoadError(null);
        return getAlertsPage(empresaId, { pageSize: PAGE_SIZE }, controller.signal);
      })
      .then((result) => {
        setItems(result.items);
        setCursor(result.nextCursor);
        setHasMore(result.nextCursor !== null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError('No se pudieron cargar las alertas.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, empresaId]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function loadMore() {
    if (!empresaId || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    getAlertsPage(empresaId, { cursor, pageSize: PAGE_SIZE })
      .then((result) => {
        setItems((prev) => [...prev, ...result.items]);
        setCursor(result.nextCursor);
        setHasMore(result.nextCursor !== null);
      })
      .catch(() => toast.error('No se pudieron cargar mas alertas.'))
      .finally(() => setIsLoadingMore(false));
  }

  function handleMarkAsRead(alert: Alert) {
    if (!empresaId || alert.leida) return;
    setMarkingId(alert.id);
    markAlertAsRead(empresaId, alert.id)
      .then(() => {
        setItems((prev) => prev.map((a) => (a.id === alert.id ? { ...a, leida: true } : a)));
        // Invalida el summary (badge) — misma politica de invalidacion
        // cruzada que el resto del proyecto tras una mutacion.
        void queryClient.invalidateQueries({ queryKey: summaryQueryKey(empresaId) });
      })
      .catch(() => toast.error('No se pudo marcar la alerta como leida.'))
      .finally(() => setMarkingId(null));
  }

  return (
    <div className="alerts-bell" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="header__action-btn header__action-btn--notify"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Alertas (${unreadCount} sin leer)` : 'Alertas'}
        title="Alertas"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="header__notify-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="alerts-bell__panel" role="dialog" aria-label="Alertas del sistema">
          <div className="alerts-bell__panel-header">
            <span>Alertas</span>
            {unreadCount > 0 && <span className="alerts-bell__unread-count">{unreadCount} sin leer</span>}
          </div>

          {isLoading && <div className="alerts-bell__empty">Cargando...</div>}
          {!isLoading && loadError && <div className="alerts-bell__empty">{loadError}</div>}
          {!isLoading && !loadError && items.length === 0 && (
            <div className="alerts-bell__empty">No hay alertas.</div>
          )}

          {!isLoading && !loadError && items.length > 0 && (
            <ul className="alerts-bell__list">
              {items.map((alert) => {
                const { title, detail } = describeAlert(alert);
                return (
                  <li
                    key={alert.id}
                    className={`alerts-bell__item${alert.leida ? ' alerts-bell__item--read' : ''}`}
                  >
                    <span className="alerts-bell__item-icon" aria-hidden="true">
                      {alert.tipo === 'transferencia-retrasada' ? <Truck size={16} /> : <PackageX size={16} />}
                    </span>
                    <span className="alerts-bell__item-body">
                      <span className="alerts-bell__item-title">{title}</span>
                      <span className="alerts-bell__item-detail">{detail}</span>
                    </span>
                    {!alert.leida && (
                      <button
                        type="button"
                        className="alerts-bell__mark-read"
                        disabled={markingId === alert.id}
                        onClick={() => handleMarkAsRead(alert)}
                        aria-label="Marcar como leida"
                        title="Marcar como leida"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && !isLoading && !loadError && (
            <button type="button" className="alerts-bell__load-more" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Cargando...' : 'Cargar mas'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
