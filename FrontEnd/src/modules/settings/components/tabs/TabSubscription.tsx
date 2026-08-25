import type { FC } from 'react';
import { SETTINGS_MOCK_INVOICES } from '../../../../data/mock/settings.data';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import '../../SettingsPage.css';

export const TabSubscription: FC = () => {
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
          <div style={{ border: '0.0625rem solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <Table
              data={SETTINGS_MOCK_INVOICES}
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
          </div>
        </div>
      </div>
    </>
  );
};
