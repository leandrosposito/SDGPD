import type { FC } from 'react';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import type { InventoryItem } from '../../../types/inventory.types';
import './TabStockCurrent.css';

// ============================================================
// TabStockCurrent — Vista principal de stock con KPIs
// ============================================================

interface TabStockCurrentProps {
  data: InventoryItem[];
  onOpenLots: (product: InventoryItem) => void;
  onEditProduct: (product: InventoryItem) => void;
  userRole: 'ADMIN' | 'EMPLOYEE';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const TabStockCurrent: FC<TabStockCurrentProps> = ({ data, onOpenLots, onEditProduct, userRole }) => {
  // Calcular KPIs
  const totalProducts = data.length;
  const lowStock = data.filter((item) => item.stock > 0 && item.stock < item.minStock).length;
  const outOfStock = data.filter((item) => item.stock === 0).length;
  const totalValue = data.reduce((acc, item) => acc + (item.stock * item.cost), 0);

  return (
    <div className="tab-stock">
      <div className="tab-stock__kpis">
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Total Productos</p>
          <p className="tab-stock__kpi-value">{totalProducts}</p>
        </div>
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Stock Bajo</p>
          <p className="tab-stock__kpi-value text-warning">{lowStock}</p>
        </div>
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Sin Stock</p>
          <p className="tab-stock__kpi-value text-danger">{outOfStock}</p>
        </div>
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Valor Inventario</p>
          <p className="tab-stock__kpi-value text-success">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      <div className="tab-stock__content">
        <Table
          data={data}
          keyExtractor={(item) => item.id}
          columns={[
            { header: 'Codigo', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
            { header: 'Nombre', accessor: 'name' },
            { header: 'Categoria', accessor: (row) => <span className="text-tertiary">{row.category}</span> },
            { header: 'Stock Actual', align: 'right', accessor: (row) => (
              <span className={row.stock === 0 ? 'text-danger font-bold' : row.stock < row.minStock ? 'text-warning font-bold' : 'font-medium'}>
                {row.stock}
              </span>
            )},
            { header: 'Costo', align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.cost)}</span> },
            { header: 'Valor Stock', align: 'right', accessor: (row) => <span className="text-accent font-medium">{formatCurrency(row.stock * row.cost)}</span> },
            { header: 'Estado', align: 'center', accessor: (row) => (
              <Badge
                label={row.stock === 0 ? 'SIN STOCK' : row.stock < row.minStock ? 'BAJO STOCK' : 'OK'}
                variant={row.stock === 0 ? 'danger' : row.stock < row.minStock ? 'warning' : 'success'}
              />
            )},
            { header: 'Acciones', align: 'center', accessor: (row) => (
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                <button 
                  className="btn-action btn-action--ghost"
                  onClick={() => onOpenLots(row)}
                >
                  Ver Lotes
                </button>
                {userRole === 'ADMIN' && (
                  <button 
                    className="btn-action btn-action--ghost"
                    onClick={() => onEditProduct(row)}
                  >
                    Editar
                  </button>
                )}
              </div>
            )},
          ]}
        />
      </div>
    </div>
  );
};
