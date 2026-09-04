import { useEffect, type FC } from 'react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { AuditLogItem } from '@/shared/types/settings.types';
import { getRecentAuditLog } from '@/modules/settings/api/audit/audit.service';
import '@/modules/settings/SettingsPage.css';

// ============================================================
// AuditLogWidget — Registro de Auditoría (Tanda 3c de escalabilidad).
// Feed chico de sidebar, sin paginación (a diferencia de las otras 2
// vistas de esta tanda) — useCachedQuery, no usePagedQuery. Sin
// mutaciones: nada en el proyecto genera entradas de auditoría reales
// todavía.
// ============================================================

const EMPTY_AUDIT_LOG: AuditLogItem[] = [];

export const AuditLogWidget: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const { data, isLoading, error, refetch } = useCachedQuery(
    'settings-audit-log',
    undefined,
    (signal) => getRecentAuditLog(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.OPERATIONAL, enabled: Boolean(empresaId) }
  );
  const auditLog = data ?? EMPTY_AUDIT_LOG;

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el registro de auditoría.');
  }, [error]);

  return (
    <div className="settings-widget">
      <div className="settings-widget__title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        Registro de Auditoría
      </div>

      {!empresaId || isLoading ? (
        <LoadingState message="Cargando auditoría..." />
      ) : error ? (
        <ErrorState message="No se pudo cargar el registro de auditoría." onRetry={refetch} />
      ) : (
        <ErrorBoundary
          fallbackTitle="No se pudo mostrar el registro de auditoría."
          fallbackMessage="Intenta de nuevo o volve al inicio."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            {auditLog.map((log) => (
              <div key={log.id} className="settings-audit-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="settings-audit-user">{log.user}</span>
                  <span className="settings-audit-time">{log.timestamp}</span>
                </div>
                <div className="settings-audit-action">{log.action}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{log.details}</div>
              </div>
            ))}
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
};
