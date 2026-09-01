import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { SidePanel } from '@/shared/components/ui/SidePanel';
import { Tabs, type TabItem } from '@/shared/components/ui/Tabs';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { PurchaseOrder } from '@/shared/types/purchaseOrder.types';
import { getPurchaseOrdersBySupplierId, computePurchaseOrderTotal } from '@/services/mock/purchaseOrders.service';
import './SupplierDetailPanel.css';

// ============================================================
// SupplierDetailPanel — Sliding detail view for a supplier
//
// La tab "Historial y Deuda" ya no lee supplier.purchaseOrders (O3,
// DECISIONES_TECNICAS.md — el campo se elimino, era una segunda fuente
// de verdad que podia divergir de Compras). Se autoconsulta contra el
// punto de entrada publico de Compras (services/mock/purchaseOrders.service),
// por supplierId — nunca importa nada de modules/compras/ (R2): ni el
// componente de alta ni siquiera su archivo de etiquetas de estado, que
// se duplica localmente mas abajo (ver el comentario ahi).
// ============================================================

interface SupplierDetailPanelProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onNewOrder: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Duplicado deliberado (no importado desde modules/compras/, R2): un
// modulo no importa archivos internos de otro, ni siquiera un mapa de
// etiquetas — solo su punto de entrada publico (services/mock/*). Es
// el mismo tipo de duplicacion consciente que "Duplica el concepto de
// KPI/top-productos" ya registrado en ESTRUCTURA_Y_ARQUITECTURA.md
// para dashboard/analytics, documentado en vez de cruzar el limite del
// modulo por una comodidad menor.
const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  received: 'Recibida',
  cancelled: 'Cancelada',
};

const PURCHASE_ORDER_STATUS_VARIANT: Record<PurchaseOrder['status'], 'neutral' | 'info' | 'success' | 'danger'> = {
  draft: 'neutral',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
};

// Referencia estable (mismo motivo que ComprasPage.tsx): evita que el
// selector de zustand devuelva un array nuevo en cada render mientras
// la sesion todavia esta cargando ("getSnapshot should be cached").
const EMPTY_BRANCHES: Branch[] = [];

export const SupplierDetailPanel: FC<SupplierDetailPanelProps> = ({
  supplier,
  isOpen,
  onClose,
  onNewOrder,
}) => {
  const [activeTab, setActiveTab] = useState('basics');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  // "Cargando" se deriva comparando el proveedor ya cargado contra el
  // actual, en vez de un setState(true) sincronico al arrancar el
  // efecto (mismo patron que loadedStockBranchId en InventoryPage.tsx —
  // evita react-hooks/set-state-in-effect).
  const [ordersLoadedForSupplierId, setOrdersLoadedForSupplierId] = useState<string | null>(null);
  const branches = useSessionStore((s) => s.session?.branches ?? EMPTY_BRANCHES);
  const branchesById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const supplierId = supplier?.id ?? null;
  const isLoadingOrders = isOpen && supplierId !== null && ordersLoadedForSupplierId !== supplierId;

  useEffect(() => {
    if (!isOpen || !supplierId) return;
    let cancelled = false;
    getPurchaseOrdersBySupplierId(supplierId)
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el historial de ordenes de compra.');
      })
      .finally(() => {
        if (!cancelled) setOrdersLoadedForSupplierId(supplierId);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, supplierId]);

  if (!supplier) return null;

  const tabs: TabItem[] = [
    {
      id: 'basics',
      label: 'Datos Basicos',
      content: (
        <div className="supplier-detail__tab-content">
          <section className="supplier-detail__section">
            <h4 className="supplier-detail__section-title">Informacion de Contacto</h4>
            <div className="supplier-detail__grid">
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Razon Social</span>
                <span className="supplier-detail__value">{supplier.name}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">CUIT</span>
                <span className="supplier-detail__value font-mono">{supplier.cuit}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Telefono</span>
                <span className="supplier-detail__value">{supplier.phone}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Contacto Comercial</span>
                <span className="supplier-detail__value">{supplier.contactName}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Email</span>
                <span className="supplier-detail__value">{supplier.contactEmail}</span>
              </div>
              <div className="supplier-detail__field supplier-detail__field--full">
                <span className="supplier-detail__label">Direccion</span>
                <span className="supplier-detail__value">{supplier.address}, {supplier.city}</span>
              </div>
            </div>
          </section>
          <section className="supplier-detail__section">
            <h4 className="supplier-detail__section-title">Condiciones Comerciales</h4>
            <div className="supplier-detail__grid">
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Plazo de Pago</span>
                <span className="supplier-detail__value">{supplier.paymentTerms}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Saldo Actual</span>
                <span className={`supplier-detail__value font-bold ${supplier.currentBalance > 0 ? 'text-danger' : ''}`}>
                  {formatCurrency(supplier.currentBalance)}
                </span>
              </div>
            </div>
          </section>
        </div>
      ),
    },
    {
      id: 'catalog',
      label: 'Catalogo de Precios',
      content: (
        <div className="supplier-detail__tab-content">
          <Table
            data={supplier.products}
            keyExtractor={(p) => p.id}
            columns={[
              { header: 'SKU', accessor: (p) => <span className="font-mono text-xs">{p.sku}</span> },
              { header: 'Producto', accessor: 'name' },
              { header: 'Categoria', accessor: (p) => <span className="text-tertiary">{p.category}</span> },
              { header: 'Costo', align: 'right', accessor: (p) => formatCurrency(p.cost) },
              { header: 'Actualizado', accessor: (p) => (
                <span className="text-tertiary text-xs">{formatDate(p.lastUpdate)}</span>
              )},
            ]}
          />
        </div>
      ),
    },
    {
      id: 'history',
      label: 'Historial y Deuda',
      content: (
        <div className="supplier-detail__tab-content">
          <div className="supplier-detail__balance-card">
            <span className="supplier-detail__balance-label">Saldo en Cuenta Corriente</span>
            <span className={`supplier-detail__balance-amount ${supplier.hasOverdueDebt ? 'text-danger' : ''}`}>
              {formatCurrency(supplier.currentBalance)}
            </span>
            {supplier.hasOverdueDebt && (
              <Badge label="Deuda Vencida" variant="danger" />
            )}
          </div>
          {isLoadingOrders ? (
            <p className="text-secondary text-sm">Cargando ordenes de compra...</p>
          ) : (
            <Table
              data={orders}
              keyExtractor={(o) => o.id}
              emptyMessage="Este proveedor todavia no tiene ordenes de compra."
              columns={[
                { header: 'OC', accessor: (o) => <span className="font-mono text-xs">{o.id}</span> },
                { header: 'Fecha', accessor: (o) => formatDate(o.createdAt) },
                { header: 'Sucursal', accessor: (o) => branchesById.get(o.branchId)?.name ?? 'Sucursal no disponible' },
                {
                  header: 'Monto',
                  align: 'right',
                  accessor: (o) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: o.currency }).format(
                    computePurchaseOrderTotal(o.lines)
                  ),
                },
                { header: 'Estado', align: 'center', accessor: (o) => (
                  <Badge
                    label={PURCHASE_ORDER_STATUS_LABEL[o.status]}
                    variant={PURCHASE_ORDER_STATUS_VARIANT[o.status]}
                  />
                )},
              ]}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={supplier.name}
      subtitle={`CUIT: ${supplier.cuit}`}
      headerActions={
        <button className="sp-btn-order" onClick={onNewOrder}>
          Nueva OC
        </button>
      }
    >
      <Tabs tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} />
    </SidePanel>
  );
};
