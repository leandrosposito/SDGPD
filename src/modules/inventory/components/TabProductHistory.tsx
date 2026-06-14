import { useState, type FC } from 'react';
import { Table } from '../../../components/ui/Table';
import type { ProductHistoryEvent } from '../../../types/inventory.types';

// ============================================================
// TabProductHistory — Auditoria de eventos de inventario
// ============================================================

interface TabProductHistoryProps {
  data: ProductHistoryEvent[];
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TabProductHistory: FC<TabProductHistoryProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const filteredData = data.filter((item) => 
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="tab-history" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header className="tab-history__header" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Historial de Producto
          </h3>
          <p className="text-secondary text-sm">
            Auditoria de cambios de precio, actualizaciones de proveedor e ingresos/egresos.
          </p>
        </div>
        
        <div style={{ maxWidth: '24rem' }}>
          <input
            type="text"
            placeholder="Buscar por SKU o Nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="form-input"
            style={{ width: '100%' }}
          />
        </div>
      </header>

      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.0625rem solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
        <Table
          data={filteredData}
          keyExtractor={(row) => row.id}
          columns={[
            { header: 'Fecha', accessor: (row) => <span className="font-mono text-xs text-secondary">{formatDate(row.date)}</span> },
            { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
            { header: 'Producto', accessor: 'productName' },
            { header: 'Evento', accessor: (row) => <span className="font-medium text-accent">{row.eventType}</span> },
            { header: 'Descripcion', accessor: (row) => <span className="text-secondary">{row.description}</span> },
            { header: 'Usuario', accessor: (row) => <span className="text-tertiary">{row.user}</span> },
          ]}
        />
      </div>
    </div>
  );
};
