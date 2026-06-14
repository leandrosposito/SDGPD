import { type FC } from 'react';
import { SidePanel } from '../../../components/ui/SidePanel';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import type { InventoryItem } from '../../../types/inventory.types';

// ============================================================
// ProductLotsPanel — Visualiza los lotes de un producto
// ============================================================

interface ProductLotsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function isExpiringSoon(expirationDate: string): boolean {
  const exp = new Date(expirationDate);
  const now = new Date();
  const diffTime = Math.abs(exp.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 30;
}

function isExpired(expirationDate: string): boolean {
  const exp = new Date(expirationDate);
  const now = new Date();
  return exp.getTime() < now.getTime();
}

export const ProductLotsPanel: FC<ProductLotsPanelProps> = ({ isOpen, onClose, product }) => {
  if (!product) return null;

  const lots = product.lots || [];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Lotes"
      subtitle={`${product.sku} - ${product.name}`}
    >
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <p className="text-secondary text-sm mb-4">
          Visualiza la composicion del stock de este producto según sus lotes activos. El despacho se realizara bajo la regla FEFO (First Expired, First Out).
        </p>

        <Table
          data={lots}
          keyExtractor={(lot) => lot.id}
          columns={[
            { header: 'N° Lote', accessor: (lot) => <span className="font-mono text-xs">{lot.lotNumber}</span> },
            { header: 'Cantidad', align: 'right', accessor: (lot) => <span className="font-medium">{lot.quantity}</span> },
            { header: 'Vencimiento', accessor: (lot) => <span className="text-tertiary text-sm">{formatDate(lot.expirationDate)}</span> },
            { header: 'Estado', align: 'center', accessor: (lot) => {
              if (isExpired(lot.expirationDate)) return <Badge label="VENCIDO" variant="danger" />;
              if (isExpiringSoon(lot.expirationDate)) return <Badge label="Proximo a vencer" variant="warning" />;
              return <Badge label="OK" variant="success" />;
            }}
          ]}
        />

        {lots.length === 0 && (
          <div className="table-empty" style={{ marginTop: 'var(--space-4)' }}>
            Este producto no tiene lotes registrados actualmente.
          </div>
        )}
      </div>
    </SidePanel>
  );
};
