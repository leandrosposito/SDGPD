import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import type { InventoryItem, StockedInventoryItem } from '@/shared/types/inventory.types';
import type { Supplier } from '@/shared/types/supplier.types';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { Tabs, type TabItem } from '@/shared/components/ui/Tabs';
import { Badge } from '@/shared/components/ui/Badge';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
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
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockedProductsForBranch,
} from '@/services/mock/products.service';
import { fetchSuppliers } from '@/services/mock/suppliers.service';
import type { ProductFormValues } from './components/ProductFormModal.schema';
import './InventoryPage.css';

// ============================================================
// InventoryPage — Inventario Avanzado y Compras
// El maestro de Productos (RF-PRD-001) vive en la pestaña "Stock Actual"
// (TabStockCurrent + ProductFormModal); el resto de las pestañas
// corresponde a RF-INV-001/RF-CAT-001/RF-PRI-001 y no se modifica aca.
//
// Stock multi-sucursal (E1, DECISIONES_TECNICAS.md): el catalogo
// (`products`) se carga una sola vez, independiente de la sucursal. El
// stock (`stockedProducts`, para TabStockCurrent) se vuelve a pedir cada
// vez que cambia `activeBranchId` — no hace falta un store de zustand
// para esto (ver 3.4 de esa tarea). TabLowStock ya no recibe datos de
// aca: se autoconsulta, paginado server-side (ver DECISIONES_TECNICAS.md,
// tarea de paginacion).
// ============================================================

const USER_ROLE: 'ADMIN' | 'EMPLOYEE' = 'ADMIN';

export const InventoryPage: FC = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [stockedProducts, setStockedProducts] = useState<StockedInventoryItem[]>([]);
  // "Cargando stock" se deriva comparando la sucursal ya cargada contra
  // la activa, en vez de un setState(true) sincronico al arrancar el
  // efecto (evita la regla react-hooks/set-state-in-effect: el efecto
  // solo hace setState dentro de sus callbacks async, igual que el
  // efecto de fetchProducts de arriba).
  const [loadedStockBranchId, setLoadedStockBranchId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('stock');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPurchaseEntryModalOpen, setIsPurchaseEntryModalOpen] = useState(false);
  const [isLotsPanelOpen, setIsLotsPanelOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const session = useSessionStore((s) => s.session);
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const activeBranchName = session?.branches.find((b) => b.id === activeBranchId)?.name ?? '';

  // Catalogo de productos y proveedores: independientes de la sucursal,
  // se cargan una sola vez.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProducts(), fetchSuppliers()])
      .then(([productsData, suppliersData]) => {
        if (!cancelled) {
          setProducts(productsData);
          setSuppliers(suppliersData);
        }
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

  // Stock de la sucursal activa (catalogo + stock para TabStockCurrent):
  // se vuelve a pedir cuando cambia la sucursal (BranchSelector) o
  // cuando cambia el catalogo (alta/edicion/baja de un producto), para
  // que el join catalogo+stock quede al dia. El bajo stock minimo ya no
  // se pide aca: TabLowStock se autoconsulta, paginado (ver ese
  // componente y DECISIONES_TECNICAS.md, tarea de paginacion server-side).
  useEffect(() => {
    if (!activeBranchId) return;
    let cancelled = false;
    getStockedProductsForBranch(activeBranchId)
      .then((stocked) => {
        if (!cancelled) setStockedProducts(stocked);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el stock de la sucursal.');
      })
      .finally(() => {
        if (!cancelled) setLoadedStockBranchId(activeBranchId);
      });
    return () => {
      cancelled = true;
    };
  }, [activeBranchId, products]);

  const isLoadingStock = loadedStockBranchId !== activeBranchId;

  const filteredStockedProducts = useMemo(() => {
    if (!searchQuery.trim()) return stockedProducts;
    const q = searchQuery.toLowerCase();
    return stockedProducts.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [stockedProducts, searchQuery]);

  // TabPurchases (3.5): sugerencias filtradas por sucursal activa. Es un
  // filtro simple sobre una lista ya en memoria (mismo criterio que
  // DeliveryFilters sobre `deliveries`), no un acceso a stock — no pasa
  // por products.service.
  const purchaseSuggestions = useMemo(
    () => INVENTORY_MOCK_DATA.suggestions.filter((s) => s.branchId === activeBranchId),
    [activeBranchId]
  );

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

  const stockTabsLoading = !activeBranchId || isLoadingProducts || isLoadingStock;

  const tabs: TabItem[] = [
    {
      id: 'stock',
      label: 'Stock Actual',
      content: stockTabsLoading ? (
        <SkeletonTable rows={5} cols={9} />
      ) : (
        <TabStockCurrent
          data={filteredStockedProducts}
          branchName={activeBranchName}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenLots={handleOpenLotsPanel}
          onEditProduct={handleOpenProductModal}
          userRole={USER_ROLE}
        />
      )
    },
    {
      id: 'low-stock',
      label: 'Bajo Stock Minimo',
      // TabLowStock se autoconsulta (paginado): solo hace falta el gate
      // de "todavia no hay sucursal activa" (sesion cargando), no
      // isLoadingStock — ese estado es interno del propio componente.
      content: !activeBranchId ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <TabLowStock branchId={activeBranchId} branchName={activeBranchName} />
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
      content: !activeBranchId ? (
        <SkeletonTable rows={3} cols={6} />
      ) : (
        <TabPurchases
          data={purchaseSuggestions}
          branchName={activeBranchName}
          branchId={activeBranchId}
          products={products}
          suppliers={suppliers}
        />
      )
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
        suppliers={suppliers}
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
