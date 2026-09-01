import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { ProductSearchBar } from './ProductSearchBar';
import type { InventoryItem, StockedInventoryItem } from '@/shared/types/inventory.types';
import './TabStockCurrent.css';

// ============================================================
// TabStockCurrent — Vista principal de stock con KPIs
// Muestra el catalogo completo con su stock EN LA SUCURSAL ACTIVA
// (E1/E5): un producto sin registro de stock ahi se ve en 0, no se
// excluye — esta tab es "el catalogo con su stock aca", no "lo que esta
// cargado en esta sucursal" (esa segunda vista es TabLowStock).
// ============================================================

interface TabStockCurrentProps {
  data: StockedInventoryItem[];
  branchName: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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

export const TabStockCurrent: FC<TabStockCurrentProps> = ({ data, branchName, searchQuery, onSearchChange, onOpenLots, onEditProduct, userRole }) => {
  // Calcular KPIs (E6: bajo minimo es stock <= minStock, no < estricto)
  const totalProducts = data.length;
  const lowStock = data.filter((item) => item.stock > 0 && item.stock <= item.minStock).length;
  const outOfStock = data.filter((item) => item.stock === 0).length;
  const totalValue = data.reduce((acc, item) => acc + (item.stock * item.cost), 0);

  return (
    <div className="tab-stock">
      <ProductSearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} />

      <p className="tab-stock__branch-note">
        Mostrando stock de <strong>{branchName}</strong>. El stock de otras sucursales no se ve aca.
      </p>

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
            { header: 'Cod. Barras', accessor: (row) => <span className="font-mono text-xs text-tertiary">{row.barcode}</span> },
            { header: 'Nombre', accessor: 'name' },
            { header: 'Categoria', accessor: (row) => <span className="text-tertiary">{row.category}</span> },
            { header: 'U.M.', accessor: (row) => <span className="text-tertiary">{row.unitOfMeasure}</span> },
            { header: 'Stock Actual', align: 'right', accessor: (row) => (
              <span className={row.stock === 0 ? 'text-danger font-bold' : row.stock <= row.minStock ? 'text-warning font-bold' : 'font-medium'}>
                {row.stock}
              </span>
            )},
            { header: 'Costo', align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.cost)}</span> },
            { header: 'Valor Stock', align: 'right', accessor: (row) => <span className="text-accent font-medium">{formatCurrency(row.stock * row.cost)}</span> },
            { header: 'Estado', align: 'center', accessor: (row) => (
              <Badge
                label={row.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                variant={row.status === 'active' ? 'success' : 'neutral'}
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
