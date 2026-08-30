import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import type { InventoryItem } from '@/shared/types/inventory.types';
import { Tabs, type TabItem } from '@/shared/components/ui/Tabs';
import { Badge } from '@/shared/components/ui/Badge';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { ProductFormModal } from './components/ProductFormModal';
import { PurchaseEntryModal } from './components/PurchaseEntryModal';
import { ProductLotsPanel } from './components/ProductLotsPanel';
import { TabStockCurrent } from './components/TabStockCurrent';
import { TabMovements } from './components/TabMovements';
import { TabPurchases } from './components/TabPurchases';
import { TabAdjustments } from './components/TabAdjustments';
import { TabCategories } from './components/TabCategories';
import { TabPriceLists } from './components/TabPriceLists';
import { TabProductHistory } from './components/TabProductHistory';
import { TabImportExport } from './components/TabImportExport';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/services/mock/products.service';
import type { ProductFormValues } from './components/ProductFormModal.schema';
import './InventoryPage.css';

// ============================================================
// InventoryPage — Inventario Avanzado y Compras
// El maestro de Productos (RF-PRD-001) vive en la pestaña "Stock Actual"
// (TabStockCurrent + ProductFormModal); el resto de las pestañas
// corresponde a RF-INV-001/RF-CAT-001/RF-PRI-001 y no se modifica aca.
// ============================================================

const USER_ROLE: 'ADMIN' | 'EMPLOYEE' = 'ADMIN';

export const InventoryPage: FC = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<string>('stock');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPurchaseEntryModalOpen, setIsPurchaseEntryModalOpen] = useState(false);
  const [isLotsPanelOpen, setIsLotsPanelOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingProducts(true);
    fetchProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el listado de productos.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProducts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const handleOpenLotsPanel = (product: InventoryItem) => {
    setSelectedProduct(product);
    setIsLotsPanelOpen(true);
  };

  const handleOpenProductModal = (product: InventoryItem | null = null) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  // RF-PRD-001: Alta / Modificacion de producto contra el mock service
  // (persiste en memoria durante la sesion, ver services/mock/products.service.ts).
  const handleSaveProduct = async (values: ProductFormValues, productId?: string) => {
    if (productId) {
      const updated = await updateProduct(productId, values);
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      return updated;
    }
    const created = await createProduct(values);
    setProducts(prev => [...prev, created]);
    return created;
  };

  // RF-PRD-001: Baja de producto (ABM completo — antes el boton "Eliminar" solo cerraba el modal).
  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const tabs: TabItem[] = [
    {
      id: 'stock',
      label: 'Stock Actual',
      content: isLoadingProducts ? (
        <SkeletonTable rows={5} cols={9} />
      ) : (
        <TabStockCurrent
          data={filteredProducts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenLots={handleOpenLotsPanel}
          onEditProduct={handleOpenProductModal}
          userRole={USER_ROLE}
        />
      )
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
        existingProducts={products}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
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
