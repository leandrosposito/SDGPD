import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { PackageCheck } from 'lucide-react';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrdersQueryFilters,
} from '@/shared/types/purchaseOrder.types';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { Pagination } from '@/shared/components/ui/Pagination';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { getPurchaseOrdersPage, updatePurchaseOrderStatus } from '@/services/mock/purchaseOrders.service';
import { PurchaseOrdersTable } from './PurchaseOrdersTable';
import { PurchaseOrderDetailPanel } from './PurchaseOrderDetailPanel';

// ============================================================
// TabPendingReceipt — OrdenesDeCompra en estado 'sent' EN LA SUCURSAL
// ACTIVA (Task B, DECISIONES_TECNICAS.md). No existe un estado
// dedicado "pendiente de recepcion": se infiere de status === 'sent'
// (unico estado intermedio entre alta y recepcion/cancelacion — ver
// VALID_TRANSITIONS en purchaseOrders.service.ts).
//
// A diferencia del "Listado General" de ComprasPage (filtro de
// sucursal MANUAL; activeBranchId es solo el default al crear, ver
// comentario de ComprasPage.tsx), esta vista se AUTO-FILTRA por la
// sucursal activa (mismo patron que LogisticsPage): recibe `branchId`
// ya resuelto como prop obligatoria, igual que TabLowStock en
// inventory — no tiene selector de sucursal propio.
//
// "Marcar como Recibida" reusa PurchaseOrderDetailPanel tal cual (ya
// soporta la transicion sent->received, O7) en vez de agregarle una
// accion nueva a PurchaseOrdersTable: "Ver detalle" abre el mismo panel
// que usa ComprasPage, pero con el `refetch` de ESTA pagina (no la del
// listado general) para que la orden desaparezca de aca al recibirla.
// ============================================================

interface TabPendingReceiptProps {
  branchId: Branch['id'];
  branchName: string;
  suppliersById: Map<Supplier['id'], Supplier>;
  branchesById: Map<Branch['id'], Branch>;
  productsById: Map<InventoryItem['id'], InventoryItem>;
}

export const TabPendingReceipt: FC<TabPendingReceiptProps> = ({
  branchId,
  branchName,
  suppliersById,
  branchesById,
  productsById,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const filters: PurchaseOrdersQueryFilters = useMemo(() => ({ status: 'sent', branchId }), [branchId]);

  const {
    items: orders,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getPurchaseOrdersPage, filters);

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de pendientes de recepcion.');
  }, [error]);

  const handleViewDetail = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const handleTransition = async (order: PurchaseOrder, nextStatus: PurchaseOrderStatus) => {
    setIsTransitioning(true);
    try {
      const result = await updatePurchaseOrderStatus(order.id, nextStatus);
      if (result.success && result.order) {
        toast.success(`Orden ${order.id} actualizada.`);
        // La orden ya no matchea status:'sent' -> desaparece de esta
        // pagina al refetchear (P10: refetch de la pagina vigente, no
        // actualizacion optimista en el cliente).
        setIsDetailOpen(false);
        refetch();
        return;
      }
      const message =
        result.reason === 'invalid-transition'
          ? 'Esa orden no puede pasar a ese estado desde su estado actual.'
          : 'No se encontro la orden de compra.';
      toast.error(message);
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="compras-page__tab-content">
      <header className="compras-page__tab-header">
        <div className="compras-page__tab-title-group">
          <PackageCheck className="compras-page__tab-icon" size={20} aria-hidden="true" />
          <div>
            <h3 className="compras-page__tab-title">Ordenes Pendientes de Recepcion</h3>
            <p className="compras-page__tab-subtitle">
              Ordenes de compra emitidas, todavia sin marcar como recibidas
            </p>
          </div>
        </div>
        <span className="compras-page__tab-count" aria-live="polite">
          {totalItems} {totalItems === 1 ? 'orden' : 'ordenes'}
        </span>
      </header>

      <p className="compras-page__tab-branch-note">
        Mostrando pendientes de recepcion de <strong>{branchName}</strong>.
      </p>

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el listado de pendientes de recepcion."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <div className="compras-page__table-container">
          {isLoading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : (
            <FetchingOverlay isFetching={isFetching}>
              <PurchaseOrdersTable
                orders={orders}
                suppliersById={suppliersById}
                branchesById={branchesById}
                onViewDetail={handleViewDetail}
              />
            </FetchingOverlay>
          )}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </ErrorBoundary>

      <PurchaseOrderDetailPanel
        order={selectedOrder}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        suppliersById={suppliersById}
        branchesById={branchesById}
        productsById={productsById}
        onTransition={handleTransition}
        isTransitioning={isTransitioning}
      />
    </div>
  );
};
