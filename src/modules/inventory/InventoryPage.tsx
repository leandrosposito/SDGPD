import { useState, type FC } from 'react';
import { INVENTORY_MOCK_DATA } from '../../data/mock/inventory.data';
import type { InventoryItem } from '../../types/inventory.types';
import { Table } from '../../components/ui/Table';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { ProductFormModal } from './components/ProductFormModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import './InventoryPage.css';

// ============================================================
// InventoryPage — Inventario Avanzado y Compras
// ============================================================

const USER_ROLE: 'ADMIN' | 'EMPLOYEE' = 'ADMIN';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const InventoryPage: FC = () => {
  const [activeTab, setActiveTab] = useState<string>('stock');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const handleOpenProductModal = (product: InventoryItem | null = null) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleOpenAdjustmentModal = (product: InventoryItem) => {
    setSelectedProduct(product);
    setIsAdjustmentModalOpen(true);
  };

  const tabs: TabItem[] = [
    {
      id: 'stock',
      label: 'Stock Actual',
      content: (
        <div className="inventory-page__tab-content">
          <Table
            data={INVENTORY_MOCK_DATA.items}
            keyExtractor={(item) => item.id}
            columns={[
              { header: 'Codigo', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
              { header: 'Nombre', accessor: 'name' },
              { header: 'Categoria', accessor: (row) => <span className="text-tertiary">{row.category}</span> },
              { header: 'Proveedor', accessor: 'supplier' },
              { header: 'Precio Venta', align: 'right', accessor: (row) => formatCurrency(row.price) },
              { header: 'Stock Actual', align: 'right', accessor: (row) => (
                <div className="inventory-page__stock-cell">
                  <span className={row.stock < row.minStock ? 'text-warning font-bold' : 'font-medium'}>
                    {row.stock}
                  </span>
                </div>
              )},
              { header: 'Stock Min.', align: 'right', accessor: 'minStock' },
              { header: 'Estado', align: 'center', accessor: (row) => (
                <Badge
                  label={row.stock < row.minStock ? 'BAJO STOCK' : 'OK'}
                  variant={row.stock < row.minStock ? 'warning' : 'success'}
                />
              )},
              { header: 'Acciones', align: 'center', accessor: (row) => (
                <div className="inventory-page__actions">
                  <button 
                    className="btn-action btn-action--ghost"
                    onClick={() => handleOpenAdjustmentModal(row)}
                  >
                    Ajustar
                  </button>
                  {USER_ROLE === 'ADMIN' && (
                    <button 
                      className="btn-action btn-action--ghost"
                      onClick={() => handleOpenProductModal(row)}
                    >
                      Editar
                    </button>
                  )}
                </div>
              )},
            ]}
          />
        </div>
      )
    },
    {
      id: 'movements',
      label: 'Movimientos',
      content: (
        <div className="inventory-page__tab-content">
          <Table
            data={INVENTORY_MOCK_DATA.movements}
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
                <span className={row.type === 'in' ? 'text-success' : row.type === 'out' ? 'text-danger' : ''}>
                  {row.type === 'out' ? '-' : '+'}{row.quantity}
                </span>
              )},
              { header: 'Usuario', accessor: (row) => <span className="text-tertiary">{row.user}</span> },
              { header: 'Notas', accessor: 'notes' },
            ]}
          />
        </div>
      )
    },
    {
      id: 'purchases',
      label: 'Sugerencias de Reposicion',
      content: (
        <div className="inventory-page__tab-content">
          <Table
            data={INVENTORY_MOCK_DATA.suggestions}
            keyExtractor={(sug) => sug.id}
            columns={[
              { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
              { header: 'Producto', accessor: 'productName' },
              { header: 'Proveedor', accessor: 'supplierName' },
              { header: 'Stock Actual', align: 'right', accessor: (row) => <span className="text-danger font-bold">{row.currentStock}</span> },
              { header: 'Sugerido', align: 'right', accessor: (row) => <span className="text-success font-bold">+{row.suggestedQuantity}</span> },
              { header: 'Costo Est.', align: 'right', accessor: (row) => formatCurrency(row.estimatedCost) },
              { header: 'Accion', align: 'center', accessor: () => (
                <button className="btn-action">Generar OC</button>
              )},
            ]}
          />
        </div>
      )
    }
  ];

  return (
    <div className="inventory-page page-enter">
      <header className="page-header">
        <div>
          <div className="page-header__title-group">
            <h2 className="page-header__title">Inventario y Compras</h2>
            <Badge label={`Role: ${USER_ROLE}`} variant="accent" />
          </div>
          <p className="page-header__subtitle">Control de stock, movimientos y reposicion</p>
        </div>
        {USER_ROLE === 'ADMIN' && (
          <button 
            className="inventory-page__btn-new"
            onClick={() => handleOpenProductModal()}
          >
            Nuevo Producto
          </button>
        )}
      </header>

      <div className="inventory-page__content">
        <Tabs tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} />
      </div>

      <ProductFormModal 
        isOpen={isProductModalOpen} 
        onClose={() => setIsProductModalOpen(false)} 
        product={selectedProduct}
      />

      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        product={selectedProduct}
      />
    </div>
  );
};
