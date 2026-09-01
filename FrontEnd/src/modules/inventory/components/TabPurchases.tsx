import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import type { PurchaseSuggestion } from '@/shared/types/inventory.types';

// ============================================================
// TabPurchases — Sugerencias de compra POR SUCURSAL (E1/3.5)
// `data` ya viene filtrada por sucursal activa desde InventoryPage.
// El boton "Generar OC" sigue sin conectar (tarea aparte); branchId ya
// viaja en cada PurchaseSuggestion para cuando se conecte.
// ============================================================

interface TabPurchasesProps {
  data: PurchaseSuggestion[];
  branchName: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const TabPurchases: FC<TabPurchasesProps> = ({ data, branchName }) => {
  return (
    <div className="tab-purchases" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header className="tab-purchases__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Sugerencias de Reposicion
          </h3>
          <p className="text-secondary text-sm">
            Productos con stock por debajo de su minimo.
          </p>
        </div>
      </header>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', background: 'var(--color-info-muted)', border: '0.0625rem solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', margin: 0 }}>
        Mostrando sugerencias de <strong>{branchName}</strong>.
      </p>

      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.0625rem solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
        <Table
          data={data}
          keyExtractor={(sug) => sug.id}
          emptyMessage="No hay sugerencias de reposicion para esta sucursal."
          columns={[
            { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
            { header: 'Producto', accessor: 'productName' },
            { header: 'Proveedor', accessor: (row) => <span className="text-tertiary">{row.supplierName}</span> },
            { header: 'Stock Actual', align: 'right', accessor: (row) => <span className="text-danger font-bold">{row.currentStock}</span> },
            { header: 'A Comprar', align: 'right', accessor: (row) => <span className="text-warning font-bold">+{row.suggestedQuantity}</span> },
            { header: 'Costo Est.', align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.estimatedCost)}</span> },
            { header: 'Accion', align: 'center', accessor: () => (
              <button className="btn-action" style={{ background: 'var(--color-bg-hover)', border: '0.0625rem solid var(--color-border)' }}>
                Generar OC
              </button>
            )},
          ]}
        />
      </div>
    </div>
  );
};
