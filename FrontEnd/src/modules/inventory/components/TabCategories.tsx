import type { FC } from 'react';
import { Table } from '../../../shared/components/ui/Table';
import { Badge } from '../../../shared/components/ui/Badge';
import './TabCategories.css';

// ============================================================
// TabCategories — Administrar familias de productos y marcas
// ============================================================

interface CategoryMock {
  id: string;
  name: string;
  code: string;
  itemsCount: number;
  suggestedMargin: number;
  status: 'active' | 'inactive';
}

const CATEGORIES_MOCK: CategoryMock[] = [
  { id: '1', name: 'Bebidas Alcoholicas', code: 'CAT-BEB-ALC', itemsCount: 45, suggestedMargin: 40, status: 'active' },
  { id: '2', name: 'Bebidas Sin Alcohol', code: 'CAT-BEB-NAL', itemsCount: 32, suggestedMargin: 30, status: 'active' },
  { id: '3', name: 'Snacks y Salados', code: 'CAT-SNA', itemsCount: 18, suggestedMargin: 35, status: 'active' },
  { id: '4', name: 'Golosinas', code: 'CAT-GOL', itemsCount: 56, suggestedMargin: 45, status: 'active' },
  { id: '5', name: 'Limpieza', code: 'CAT-LIM', itemsCount: 24, suggestedMargin: 25, status: 'active' },
  { id: '6', name: 'Descontinuados', code: 'CAT-OLD', itemsCount: 0, suggestedMargin: 0, status: 'inactive' },
];

export const TabCategories: FC = () => {
  return (
    <div className="tab-categories">
      <header className="tab-categories__header">
        <div>
          <h3 className="tab-categories__title">Categorias de Productos</h3>
          <p className="tab-categories__subtitle">Administra las familias y clasificaciones del inventario.</p>
        </div>
        <button className="tab-categories__btn-new">
          Nueva Categoria
        </button>
      </header>

      <div className="tab-categories__content">
        <Table
          data={CATEGORIES_MOCK}
          keyExtractor={(item) => item.id}
          columns={[
            { header: 'Codigo', accessor: (row) => <span className="font-mono text-xs">{row.code}</span> },
            { header: 'Nombre de Categoria', accessor: (row) => <span className="font-medium">{row.name}</span> },
            { header: 'Cant. Productos', align: 'right', accessor: (row) => <span className="text-secondary">{row.itemsCount} prods</span> },
            { header: 'Margen Sugerido (%)', align: 'right', accessor: (row) => <span className="text-accent font-medium">{row.suggestedMargin}%</span> },
            { header: 'Estado', align: 'center', accessor: (row) => (
              <Badge 
                label={row.status === 'active' ? 'Activa' : 'Inactiva'} 
                variant={row.status === 'active' ? 'success' : 'neutral'} 
              />
            )},
            { header: 'Acciones', align: 'center', accessor: () => (
              <button className="btn-action btn-action--ghost">Editar</button>
            )}
          ]}
        />
      </div>
    </div>
  );
};
