import type { FC } from 'react';
import { Table } from '../../../shared/components/ui/Table';
import './TabPriceLists.css';

// ============================================================
// TabPriceLists — Administrar margenes y precios por tipo
// ============================================================

interface PriceListMock {
  id: string;
  sku: string;
  name: string;
  cost: number;
  wholesaleMargin: number;
  distributorMargin: number;
  retailMargin: number;
}

const PRICE_LIST_MOCK: PriceListMock[] = [
  { id: '1', sku: 'ACE-GIR-15', name: 'Aceite de Girasol 1.5L', cost: 1500, wholesaleMargin: 20, distributorMargin: 30, retailMargin: 40 },
  { id: '2', sku: 'YER-MAT-1K', name: 'Yerba Mate 1kg Paquete', cost: 2800, wholesaleMargin: 15, distributorMargin: 20, retailMargin: 30 },
  { id: '3', sku: 'AZU-BLA-1K', name: 'Azucar Blanca 1kg', cost: 800, wholesaleMargin: 10, distributorMargin: 15, retailMargin: 25 },
  { id: '4', sku: 'PROD-004', name: 'Gaseosa Cola 2.25L', cost: 350, wholesaleMargin: 15, distributorMargin: 20, retailMargin: 30 },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const TabPriceLists: FC = () => {
  return (
    <div className="tab-pricelists">
      <header className="tab-pricelists__header">
        <div>
          <h3 className="tab-pricelists__title">Listas de Precios y Margenes</h3>
          <p className="tab-pricelists__subtitle">Ajusta el margen de ganancia para calcular los precios finales automaticamente.</p>
        </div>
        <button className="tab-pricelists__btn-save">
          Guardar Cambios
        </button>
      </header>

      <div className="tab-pricelists__content">
        <Table
          data={PRICE_LIST_MOCK}
          keyExtractor={(item) => item.id}
          columns={[
            { header: 'Codigo', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
            { header: 'Producto', accessor: 'name' },
            { header: 'Costo', align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.cost)}</span> },
            { header: 'Margen Mayorista', align: 'center', accessor: (row) => (
              <div className="tab-pricelists__input-wrapper">
                <input 
                  type="number" 
                  className="tab-pricelists__input-margin" 
                  defaultValue={row.wholesaleMargin || 0}
                  min="0"
                  step="1"
                />
                <span className="tab-pricelists__input-symbol">%</span>
              </div>
            )},
            { header: 'Precio Mayorista', align: 'right', accessor: (row) => <span className="font-medium text-accent">{formatCurrency(row.cost * (1 + (row.wholesaleMargin || 0) / 100))}</span> },
            { header: 'Margen Dist.', align: 'center', accessor: (row) => (
              <div className="tab-pricelists__input-wrapper">
                <input 
                  type="number" 
                  className="tab-pricelists__input-margin" 
                  defaultValue={row.distributorMargin || 0}
                  min="0"
                  step="1"
                />
                <span className="tab-pricelists__input-symbol">%</span>
              </div>
            )},
            { header: 'Precio Dist.', align: 'right', accessor: (row) => <span className="font-medium text-accent">{formatCurrency(row.cost * (1 + (row.distributorMargin || 0) / 100))}</span> },
            { header: 'Margen Minorista', align: 'center', accessor: (row) => (
              <div className="tab-pricelists__input-wrapper">
                <input 
                  type="number" 
                  className="tab-pricelists__input-margin" 
                  defaultValue={row.retailMargin || 0}
                  min="0"
                  step="1"
                />
                <span className="tab-pricelists__input-symbol">%</span>
              </div>
            )},
            { header: 'Precio Minorista', align: 'right', accessor: (row) => <span className="font-medium text-accent">{formatCurrency(row.cost * (1 + (row.retailMargin || 0) / 100))}</span> },
          ]}
        />
      </div>
    </div>
  );
};
