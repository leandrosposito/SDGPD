import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Table } from '@/shared/components/ui/Table';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { InventoryItem, PurchaseSuggestion } from '@/shared/types/inventory.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageSort } from '@/shared/types/pagination.types';
import {
  getPurchaseSuggestionsPage,
  exportPurchaseSuggestions,
  type PurchaseSuggestionsQueryFilters,
  type PurchaseSuggestionsSortField,
} from '@/modules/inventory/api/purchase-suggestions/purchase-suggestions.service';
import { generatePurchaseOrderFromSuggestion } from '@/services/mock/purchaseOrders.service';
import './TabPurchases.css';

// ============================================================
// TabPurchases — Sugerencias de compra POR SUCURSAL (E1/3.5),
// paginado server-side (Tanda 3f de escalabilidad, cierra la última
// tanda de migración pendiente — ver AUDIT_2026-09-07_conexion-export-3fg.md).
// Se autoconsulta via usePagedQuery + purchase-suggestions.service#getPurchaseSuggestionsPage
// — ya no recibe `data` por props (antes InventoryPage armaba el array
// completo filtrando INVENTORY_MOCK_DATA.suggestions en memoria).
// `products`/`suppliers` SI siguen viniendo por props (catálogos
// completos ya cacheados en InventoryPage vía useCachedQuery, no se
// duplica ese fetch acá) — solo hacen falta para "Generar OC".
//
// "Generar OC" (O9, DECISIONES_TECNICAS.md) crea una OrdenDeCompra en
// Compras para el proveedor REAL del producto (InventoryItem.supplierId,
// nunca `suggestion.supplierName` — ese campo es solo de exhibicion,
// texto libre que puede no coincidir con ningun Supplier real). Si el
// producto no tiene un proveedor valido asociado, se rechaza con un
// mensaje claro y no se genera nada (O9). Sin cambios de esta tanda.
// ============================================================

interface TabPurchasesProps {
  branchName: string;
  branchId: Branch['id'];
  products: InventoryItem[];
  suppliers: Supplier[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const TabPurchases: FC<TabPurchasesProps> = ({ branchName, branchId, products, suppliers }) => {
  const navigate = useNavigate();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const empresaId = useSessionStore((s) => s.session?.company.id);

  // Tanda 4 (corrida completa, A13): pagina y orden en la URL, prefijo
  // `rep_`.
  const urlState = useUrlListState<PurchaseSuggestionsSortField, never>({
    prefix: 'rep',
    sortFields: ['productName', 'currentStock', 'suggestedQuantity', 'estimatedCost'],
  });

  const filters: PurchaseSuggestionsQueryFilters = useMemo(
    () => ({ empresaId: empresaId ?? '', branchId }),
    [empresaId, branchId]
  );

  const {
    items: data,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    sort,
    setPage,
    setPageSize,
    setSort,
    refetch,
  } = usePagedQuery(getPurchaseSuggestionsPage, filters, {
    page: urlState.page,
    onPageChange: urlState.setPage,
    sort: urlState.sort,
    onSortChange: urlState.setSort,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar las sugerencias de reposicion.');
  }, [error]);

  const sortField = sort?.field ?? 'currentStock';
  const sortDesc = sort?.direction === 'desc';

  const handleSort = (field: PurchaseSuggestionsSortField) => {
    const next: PageSort<PurchaseSuggestionsSortField> =
      sortField === field ? { field, direction: sortDesc ? 'asc' : 'desc' } : { field, direction: 'asc' };
    setSort(next);
  };

  const renderSortableHeader = (label: string, field: PurchaseSuggestionsSortField) => (
    <button type="button" className="tab-purchases__sort-btn" onClick={() => handleSort(field)}>
      {label}
      {sortField === field && <span className="tab-purchases__sort-arrow">{sortDesc ? '▼' : '▲'}</span>}
    </button>
  );

  const handleGenerateOrder = async (suggestion: PurchaseSuggestion) => {
    if (!empresaId) return;
    const product = products.find((p) => p.id === suggestion.productId);
    if (!product) {
      toast.error(`No se encontro "${suggestion.productName}" en el catalogo de productos.`);
      return;
    }

    const supplier = suppliers.find((s) => s.id === product.supplierId);
    if (!supplier) {
      // O9: producto sin proveedor valido — se rechaza sin romper, con
      // motivo claro. No se llama al servicio de Compras con un
      // supplierId inventado.
      toast.error(
        `"${product.name}" no tiene un proveedor valido asociado. Asigna un proveedor real desde Productos antes de generar la OC.`
      );
      return;
    }

    setGeneratingId(suggestion.id);
    try {
      const unitPrice = suggestion.suggestedQuantity > 0
        ? suggestion.estimatedCost / suggestion.suggestedQuantity
        : suggestion.estimatedCost;

      const result = await generatePurchaseOrderFromSuggestion(empresaId, {
        supplierId: supplier.id,
        branchId,
        productId: product.id,
        quantity: suggestion.suggestedQuantity,
        unitPrice,
        currency: 'ARS',
      });

      if (!result.success || !result.order) {
        toast.error(
          result.reason === 'inactive-product'
            ? `"${product.name}" esta dado de baja y no puede agregarse a una orden de compra.`
            : 'No se pudo generar la orden de compra.'
        );
        return;
      }

      // Invalidacion por mutacion (Tanda 2.5, tabla completa en
      // DECISIONES_TECNICAS.md): generar una OC desde Inventario
      // invalida el cache de ordenes de compra de Compras (paginado,
      // Tanda 2 — no se importa nada de modules/compras/, R2: se
      // invalida por la MISMA key jerarquica que arma ese modulo, via
      // shared/api/, no importando su codigo) y el historial de OC del
      // proveedor (Tanda 2.5, useCachedQuery en SupplierDetailPanel) —
      // asi ambos quedan al dia sin depender de un refresh manual.
      if (empresaId) {
        void queryClient.invalidateQueries({ queryKey: ['paged', 'getPurchaseOrdersPage', empresaId] });
        void queryClient.invalidateQueries({
          queryKey: ['cached', 'purchase-orders-by-supplier', empresaId, supplier.id],
        });
      }

      const message = result.merged
        ? `Se agrego "${product.name}" a la orden ${result.order.id} (borrador existente para ${supplier.name}).`
        : `Se creo la orden ${result.order.id} (borrador) para ${supplier.name}.`;

      toast.success(message, {
        action: {
          label: 'Ver en Compras',
          onClick: () => navigate('/compras'),
        },
      });

      // La OC generada no cambia el stock (eso ocurre al recibirla en
      // Compras) — pero re-pedimos la pagina vigente igual (P10) por si
      // el mock de sugerencias llegara a reflejar el estado futuro.
      refetch();
    } finally {
      setGeneratingId(null);
    }
  };

  const exportColumns: ExportColumn<PurchaseSuggestion>[] = [
    { header: 'SKU', accessor: (s) => s.sku },
    { header: 'Producto', accessor: (s) => s.productName },
    { header: 'Proveedor', accessor: (s) => s.supplierName },
    { header: 'Stock Actual', accessor: (s) => s.currentStock },
    { header: 'A Comprar', accessor: (s) => s.suggestedQuantity },
    { header: 'Costo Est.', accessor: (s) => s.estimatedCost },
  ];

  if (isLoading) {
    return <LoadingState message="Cargando sugerencias de reposicion..." />;
  }

  if (error) {
    return <ErrorState message="No se pudo cargar las sugerencias de reposicion." onRetry={refetch} />;
  }

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
        <ExportButton fileNamePrefix="reposicion" columns={exportColumns} fetchRows={() => exportPurchaseSuggestions(filters, sort)} />
      </header>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', background: 'var(--color-info-muted)', border: '0.0625rem solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', margin: 0 }}>
        Mostrando sugerencias de <strong>{branchName}</strong>.
      </p>

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar las sugerencias de reposicion."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <FetchingOverlay isFetching={isFetching}>
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.0625rem solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
            <Table
              data={data}
              keyExtractor={(sug) => sug.id}
              emptyMessage="No hay sugerencias de reposicion para esta sucursal."
              columns={[
                { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
                { header: renderSortableHeader('Producto', 'productName'), accessor: 'productName' },
                { header: 'Proveedor', accessor: (row) => <span className="text-tertiary">{row.supplierName}</span> },
                { header: renderSortableHeader('Stock Actual', 'currentStock'), align: 'right', accessor: (row) => <span className="text-danger font-bold">{row.currentStock}</span> },
                { header: renderSortableHeader('A Comprar', 'suggestedQuantity'), align: 'right', accessor: (row) => <span className="text-warning font-bold">+{row.suggestedQuantity}</span> },
                { header: renderSortableHeader('Costo Est.', 'estimatedCost'), align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.estimatedCost)}</span> },
                { header: 'Accion', align: 'center', accessor: (row) => (
                  <button
                    type="button"
                    className="btn-action"
                    style={{ background: 'var(--color-bg-hover)', border: '0.0625rem solid var(--color-border)' }}
                    onClick={() => handleGenerateOrder(row)}
                    disabled={generatingId === row.id}
                    aria-label={`Generar orden de compra para ${row.productName}`}
                  >
                    {generatingId === row.id ? 'Generando...' : 'Generar OC'}
                  </button>
                )},
              ]}
            />
          </div>
        </FetchingOverlay>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </ErrorBoundary>
    </div>
  );
};
