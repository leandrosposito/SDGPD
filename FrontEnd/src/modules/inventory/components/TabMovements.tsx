import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { InventoryMovement } from '@/shared/types/inventory.types';

// ============================================================
// TabMovements — Historial de entradas y salidas fisicas
// ============================================================

interface TabMovementsProps {
  data: InventoryMovement[];
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TabMovements: FC<TabMovementsProps> = ({ data }) => {
  return (
    <div className="tab-movements">
      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.0625rem solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
        <Table
          data={data}
          keyExtractor={(mov) => mov.id}
          columns={[
            { header: 'Fecha', accessor: (row) => <span className="font-mono text-xs text-secondary">{formatDate(row.date)}</span> },
            { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
            { header: 'Producto', accessor: 'productName' },
            { header: 'Tipo', accessor: (row) => (
              <Badge
                label={row.type === 'in' ? 'Ingreso' : row.type === 'out' ? 'Egreso' : 'Ajuste'}
                variant={row.type === 'in' ? 'success' : row.type === 'out' ? 'warning' : 'neutral'}
              />
            )},
            { header: 'Cant.', align: 'right', accessor: (row) => (
              <span className={row.type === 'in' ? 'text-success font-medium' : row.type === 'out' ? 'text-danger font-medium' : 'font-medium'}>
                {row.type === 'out' ? '-' : '+'}{row.quantity}
              </span>
            )},
            { header: 'Usuario', accessor: (row) => <span className="text-tertiary">{row.user}</span> },
            { header: 'Notas', accessor: 'notes' },
          ]}
        />
      </div>
    </div>
  );
};
