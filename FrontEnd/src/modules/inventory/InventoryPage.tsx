import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import type { InventoryItem, StockedInventoryItem } from '@/shared/types/inventory.types';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { cachedQueryKey } from '@/shared/api/queryKeys';
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
import { fetchSuppliers } from '@/modules/suppliers/api/suppliers.service';
import type { ProductFormValues } from './components/ProductFormModal.schema';
import './InventoryPage.css';

// ============================================================
// InventoryPage — Inventario Avanzado y Compras
// El maestro de Productos (RF-PRD-001) vive en la pestaña "Stock Actual"
// (TabStockCurrent + ProductFormModal); el resto de las pestañas
// corresponde a RF-INV-001/RF-CAT-001/RF-PRI-001 y no se modifica aca.
//
// Stock multi-sucursal (E1, DECISIONES_TECNICAS.md): el catalogo
// (`products`) es de EMPRESA, no de sucursal (Tanda 2.5, decision
// cerrada: el producto existe independientemente de donde haya stock).
// El stock (para TabStockCurrent) SI es por sucursal. TabLowStock ya no
// recibe datos de aca: se autoconsulta, paginado server-side.
//
// Cache (Tanda 2.5, useCachedQuery — ver RELEVAMIENTO_CACHE.md y
// DECISIONES_TECNICAS.md): catalogo de productos y lista de proveedores
// usan queryName 'products'/'suppliers-list' — el MISMO queryName que
// usan ComprasPage y CreateOrderModal, asi que los 3 comparten una sola
// entrada de cache (dedupe entre modulos, no 3 fetches independientes).
// ============================================================

const USER_ROLE: 'ADMIN' | 'EMPLOYEE' = 'ADMIN';

// Referencia estable para el fallback de `data` mientras useCachedQuery
// no resolvio todavia — un `?? []` nuevo en cada render rompe la
// memoizacion de todo lo que dependa de esa referencia (ver
// filteredStockedProducts mas abajo).
const EMPTY_STOCKED_PRODUCTS: StockedInventoryItem[] = [];

export const InventoryPage: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<string>('stock');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPurchaseEntryModalOpen, setIsPurchaseEntryModalOpen] = useState(false);
  const [isLotsPanelOpen, setIsLotsPanelOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const session = useSessionStore((s) => s.session);
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const activeBranchName = session?.branches.find((b) => b.id === activeBranchId)?.name ?? '';
  const queryClient = useQueryClient();
  const empresaId = session?.company.id;

  // Catalogo de productos (empresa, no sucursal) — queryName 'products',
  // compartido con ComprasPage/CreateOrderModal (dedupe real entre los 3).
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    error: productsError,
  } = useCachedQuery('products', undefined, (signal) => fetchProducts(signal), {
    staleTime: CACHE_STALE_TIME.CATALOG,
  });
  const products = productsData ?? [];

  useEffect(() => {
    if (productsError) toast.error('No se pudo cargar el listado de productos.');
  }, [productsError]);

  // Lista completa de proveedores (empresa) — queryName 'suppliers-list',
  // compartido con ComprasPage. Distinto de fetchSuppliersPage
  // (SuppliersPage, paginado, ya cacheado por usePagedQuery/Tanda 2).
  const {
    data: suppliersData,
    error: suppliersError,
  } = useCachedQuery(
    'suppliers-list',
    undefined,
    (signal) => fetchSuppliers(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.CATALOG, enabled: Boolean(empresaId) }
  );
  const suppliers = suppliersData ?? [];

  useEffect(() => {
    if (suppliersError) toast.error('No se pudo cargar el listado de proveedores.');
  }, [suppliersError]);

  // Stock de la sucursal activa (catalogo unido a stock, para
  // TabStockCurrent) — queryName 'stock-by-branch', keyParams=branchId
  // (una entrada de cache por sucursal). Se vuelve a pedir solo cuando
  // cambia de verdad: cambio de sucursal (key distinta) o una mutacion
  // de producto que invalida esta key explicitamente (ver
  // handleSaveProduct/handleDeleteProduct mas abajo) — ya no depende de
  // la referencia de `products`, asi que no hay doble disparo por
  // montaje (RELEVAMIENTO_CACHE.md, D2).
  const {
    data: stockedProductsData,
    isLoading: isLoadingStock,
    error: stockError,
  } = useCachedQuery(
    'stock-by-branch',
    activeBranchId,
    (signal) => getStockedProductsForBranch(activeBranchId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.OPERATIONAL, enabled: Boolean(activeBranchId) }
  );
  const stockedProducts = stockedProductsData ?? EMPTY_STOCKED_PRODUCTS;

  useEffect(() => {
    if (stockError) toast.error('No se pudo cargar el stock de la sucursal.');
  }, [stockError]);

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

  // Invalidacion por mutacion (Tanda 2.5, tabla completa en
  // DECISIONES_TECNICAS.md): crear/editar/borrar un producto invalida
  // el catalogo de productos Y el stock de sucursal (el join incluye
  // nombre/sku del producto, que pudo cambiar) — quirurgica por prefijo
  // de key, nunca toca 'suppliers-list' ni 'clients' ni ningun otro
  // dato. Sin keyParams en el prefijo: invalida TODAS las sucursales de
  // 'stock-by-branch' (el producto puede tener stock en mas de una), no
  // solo la activa.
  function invalidateProductCaches() {
    if (!empresaId) return;
    void queryClient.invalidateQueries({ queryKey: cachedQueryKey({ queryName: 'products', empresaId }) });
    void queryClient.invalidateQueries({ queryKey: cachedQueryKey({ queryName: 'stock-by-branch', empresaId }) });
  }

  // RF-PRD-001: Alta / Modificacion de producto contra el mock service
  // (persiste en memoria durante la sesion, ver services/mock/products.service.ts).
  const handleSaveProduct = async (values: ProductFormValues, productId?: string) => {
    if (productId) {
      const updated = await updateProduct(productId, values);
      invalidateProductCaches();
      return updated;
    }
    const created = await createProduct(values);
    invalidateProductCaches();
    return created;
  };

  // RF-PRD-001: Baja de producto (ABM completo — antes el boton "Eliminar" solo cerraba el modal).
  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
    invalidateProductCaches();
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
