import { type FC } from 'react';
import type { OrderStatus } from '../../../types/order.types';
import './OrderFilters.css';

// ============================================================
// OrderFilters — Status quick-filter bar + client search
// ============================================================

interface FilterOption {
  value: OrderStatus | 'all';
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all',        label: 'Todos' },
  { value: 'pending',    label: 'Pendiente' },
  { value: 'preparing',  label: 'Preparando' },
  { value: 'dispatched', label: 'Despachado' },
  { value: 'delivered',  label: 'Entregado' },
  { value: 'cancelled',  label: 'Cancelado' },
];

interface OrderFiltersProps {
  activeStatus: OrderStatus | 'all';
  searchQuery: string;
  onStatusChange: (status: OrderStatus | 'all') => void;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

const IconSearch: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

export const OrderFilters: FC<OrderFiltersProps> = ({
  activeStatus,
  searchQuery,
  onStatusChange,
  onSearchChange,
  totalCount,
  filteredCount,
}) => {
  return (
    <div className="order-filters">
      <div className="order-filters__top">
        <div className="order-filters__pills" role="group" aria-label="Filtrar por estado">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`order-filters__pill${activeStatus === opt.value ? ' order-filters__pill--active' : ''}`}
              onClick={() => onStatusChange(opt.value)}
              aria-pressed={activeStatus === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="order-filters__search-wrap">
          <IconSearch className="order-filters__search-icon" />
          <input
            id="order-search"
            type="search"
            className="order-filters__search-input"
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar por nombre de cliente"
          />
        </div>
      </div>

      <p className="order-filters__count" aria-live="polite">
        Mostrando {filteredCount} de {totalCount} pedidos
      </p>
    </div>
  );
};
