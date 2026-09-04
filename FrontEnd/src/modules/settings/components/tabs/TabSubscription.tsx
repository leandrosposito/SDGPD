import { useEffect, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { Pagination } from '@/shared/components/ui/Pagination';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { getInvoicesPage, type InvoicesQueryFilters } from '@/modules/settings/api/subscription/subscription.service';
import '@/modules/settings/SettingsPage.css';

// ============================================================
// TabSubscription — Suscripción y Facturación (Tanda 3c de
// escalabilidad). Solo el Historial de Cobros migra a la capa api/ +
// usePagedQuery: la card "Plan Actual" (Premium, próximo cobro) es
// texto hardcodeado en el JSX, sin ningún dato real detrás — se deja
// tal cual, no se inventa un DTO para eso (ver DECISIONES_TECNICAS.md).
// "Actualizar Medio de Pago" sigue sin `onClick` — decorativo desde
// antes de esta tanda.
// ============================================================

export const TabSubscription: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const filters: InvoicesQueryFilters = useMemo(() => ({ empresaId: empresaId ?? '' }), [empresaId]);

  const {
    items: invoices,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getInvoicesPage, filters, { enabled: Boolean(empresaId) });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el historial de cobros.');
  }, [error]);

  return (
    <>
      <h3 className="settings-section-title">Suscripción y Facturación SaaS</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <div style={{ background: 'var(--color-bg-base)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '0.0625rem solid var(--color-accent-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 'var(--letter-spacing-wide)' }}>Plan Actual</div>
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>Premium</div>
            </div>
            <Badge label="Activo" variant="success" />
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
            Facturación mensual. Próximo cobro el 01/07/2026 por $15.000 (ARS).
          </div>
          <button className="client-modal-btn client-modal-btn--primary" style={{ width: '100%' }}>Actualizar Medio de Pago</button>
        </div>

        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>Historial de Cobros</h4>
          {!empresaId || isLoading ? (
            <LoadingState message="Cargando historial de cobros..." />
          ) : error ? (
            <ErrorState message="No se pudo cargar el historial de cobros." onRetry={refetch} />
          ) : (
            <ErrorBoundary
              fallbackTitle="No se pudo mostrar el historial de cobros."
              fallbackMessage="Intenta de nuevo o volve al inicio."
            >
              <div style={{ border: '0.0625rem solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <FetchingOverlay isFetching={isFetching}>
                  <Table
                    data={invoices}
                    keyExtractor={(i) => i.id}
                    columns={[
                      { header: 'Fecha', accessor: 'date' },
                      { header: 'Plan', accessor: 'plan' },
                      { header: 'Monto', accessor: (row) => `$${row.amount.toLocaleString('es-AR')}` },
                      {
                        header: 'Estado',
                        align: 'right',
                        accessor: (row) => <Badge label={row.status === 'paid' ? 'Pagado' : 'Pendiente'} variant={row.status === 'paid' ? 'success' : 'warning'} />
                      }
                    ]}
                  />
                </FetchingOverlay>
              </div>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </>
  );
};
