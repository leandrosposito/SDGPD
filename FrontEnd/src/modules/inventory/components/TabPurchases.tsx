import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import type { InventoryItem, PurchaseSuggestion } from '@/shared/types/inventory.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { Branch } from '@/shared/types/session.types';
import { generatePurchaseOrderFromSuggestion } from '@/services/mock/purchaseOrders.service';

// ============================================================
// TabPurchases — Sugerencias de compra POR SUCURSAL (E1/3.5).
// "Generar OC" (O9, DECISIONES_TECNICAS.md) crea una OrdenDeCompra en
// Compras para el proveedor REAL del producto (InventoryItem.supplierId,
// nunca `suggestion.supplierName` — ese campo es solo de exhibicion,
// texto libre que puede no coincidir con ningun Supplier real). Si el
// producto no tiene un proveedor valido asociado, se rechaza con un
// mensaje claro y no se genera nada (O9).
// ============================================================

interface TabPurchasesProps {
  data: PurchaseSuggestion[];
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

export const TabPurchases: FC<TabPurchasesProps> = ({ data, branchName, branchId, products, suppliers }) => {
  const navigate = useNavigate();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleGenerateOrder = async (suggestion: PurchaseSuggestion) => {
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

      const result = await generatePurchaseOrderFromSuggestion({
        supplierId: supplier.id,
        branchId,
        productId: product.id,
        quantity: suggestion.suggestedQuantity,
        unitPrice,
        currency: 'ARS',
      });

      if (!result.success || !result.order) {
        toast.error('No se pudo generar la orden de compra.');
        return;
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
    } finally {
      setGeneratingId(null);
    }
  };

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
      </header>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', background: 'var(--color-info-muted)', border: '0.0625rem solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', margin: 0 }}>
        Mostrando sugerencias de <strong>{branchName}</strong>.
      </p>

      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.0625rem solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
        <Table
          data={data}
          keyExtractor={(sug) => sug.id}
          emptyMessage="No hay sugerencias de reposicion para esta sucursal."
          columns={[
            { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
            { header: 'Producto', accessor: 'productName' },
            { header: 'Proveedor', accessor: (row) => <span className="text-tertiary">{row.supplierName}</span> },
            { header: 'Stock Actual', align: 'right', accessor: (row) => <span className="text-danger font-bold">{row.currentStock}</span> },
            { header: 'A Comprar', align: 'right', accessor: (row) => <span className="text-warning font-bold">+{row.suggestedQuantity}</span> },
            { header: 'Costo Est.', align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.estimatedCost)}</span> },
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
    </div>
  );
};
