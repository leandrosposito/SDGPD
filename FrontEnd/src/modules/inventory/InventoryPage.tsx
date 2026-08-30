import { useState, type FC } from 'react';
import { INVENTORY_MOCK_DATA } from '../../data/mock/inventory.data';
import type { InventoryItem } from '../../shared/types/inventory.types';
import { Tabs, type TabItem } from '../../shared/components/ui/Tabs';
import { Badge } from '../../shared/components/ui/Badge';
import { ProductFormModal } from './components/ProductFormModal';
import { PurchaseEntryModal } from './components/PurchaseEntryModal';
import { ProductLotsPanel } from './components/ProductLotsPanel';
import { TabStockCurrent } from './components/TabStockCurrent';
import { TabLowStock } from './components/TabLowStock';
import { TabMovements } from './components/TabMovements';
import { TabPurchases } from './components/TabPurchases';
import { TabAdjustments } from './components/TabAdjustments';
import { TabCategories } from './components/TabCategories';
import { TabPriceLists } from './components/TabPriceLists';
import { TabProductHistory } from './components/TabProductHistory';
import { TabImportExport } from './components/TabImportExport';
import './InventoryPage.css';

// ============================================================
// InventoryPage — Inventario Avanzado y Compras
// ============================================================

const USER_ROLE: 'ADMIN' | 'EMPLOYEE' = 'ADMIN';

export const InventoryPage: FC = () => {
  const [activeTab, setActiveTab] = useState<string>('stock');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPurchaseEntryModalOpen, setIsPurchaseEntryModalOpen] = useState(false);
  const [isLotsPanelOpen, setIsLotsPanelOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const handleOpenLotsPanel = (product: InventoryItem) => {
    setSelectedProduct(product);
    setIsLotsPanelOpen(true);
  };

  const handleOpenProductModal = (product: InventoryItem | null = null) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const tabs: TabItem[] = [
    {
      id: 'stock',
      label: 'Stock Actual',
      content: (
        <TabStockCurrent
          data={INVENTORY_MOCK_DATA.items}
          onOpenLots={handleOpenLotsPanel}
          onEditProduct={handleOpenProductModal}
          userRole={USER_ROLE}
        />
      )
    },
    {
      id: 'low-stock',
      label: 'Bajo Stock Minimo',
      content: <TabLowStock data={INVENTORY_MOCK_DATA.items} />
    },
    {
      id: 'movements',
      label: 'Movimientos',
      content: <TabMovements data={INVENTORY_MOCK_DATA.movements} />
    },
    {
      id: 'purchases',
      label: 'Reposicion',
      content: <TabPurchases data={INVENTORY_MOCK_DATA.suggestions} />
    },
    {
      id: 'adjustments',
      label: 'Ajustes de Stock',
      content: <TabAdjustments />
    },
    {
      id: 'categories',
      label: 'Categorias',
      content: <TabCategories />
    },
    {
      id: 'pricelists',
      label: 'Listas de Precios',
      content: <TabPriceLists />
    },
    {
      id: 'history',
      label: 'Historial del Producto',
      content: <TabProductHistory data={INVENTORY_MOCK_DATA.history} />
    },
    {
      id: 'importexport',
      label: 'Importar / Exportar',
      content: <TabImportExport />
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
        <div className="inventory-page__header-actions" style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {USER_ROLE === 'ADMIN' && (
            <button 
              className="client-modal-btn client-modal-btn--outline"
              onClick={() => setIsPurchaseEntryModalOpen(true)}
            >
              Registrar Compra
            </button>
          )}
          {USER_ROLE === 'ADMIN' && (
            <button 
              className="client-modal-btn client-modal-btn--primary"
              onClick={() => handleOpenProductModal()}
            >
              Nuevo Producto
            </button>
          )}
        </div>
      </header>

      <div className="inventory-page__content">
        <Tabs tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} />
      </div>

      <ProductFormModal 
        isOpen={isProductModalOpen} 
        onClose={() => setIsProductModalOpen(false)} 
        product={selectedProduct}
      />

      <PurchaseEntryModal
        isOpen={isPurchaseEntryModalOpen}
        onClose={() => setIsPurchaseEntryModalOpen(false)}
      />

      <ProductLotsPanel
        isOpen={isLotsPanelOpen}
        onClose={() => setIsLotsPanelOpen(false)}
        product={selectedProduct}
      />
    </div>
  );
};
