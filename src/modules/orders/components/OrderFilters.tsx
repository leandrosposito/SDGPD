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
  { value: 'invoiced',   label: 'Facturado' },
  { value: 'cancelled',  label: 'Cancelado' },
];

interface OrderFiltersProps {
  activeStatus: OrderStatus | 'all';
  searchQuery: string;
  onStatusChange: (status: OrderStatus | 'all') => void;
  onSearchChange: (query: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  seller: string;
  onSellerChange: (seller: string) => void;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
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
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  seller,
  onSellerChange,
  paymentMethod,
  onPaymentMethodChange,
  totalCount,
  filteredCount,
}) => {
  return (
    <div className="order-filters">
      <div className="order-filters__grid">
        <div className="order-filters__form-group">
          <label htmlFor="filter-search" className="order-filters__label">Cliente</label>
          <div className="order-filters__search-wrap">
            <IconSearch className="order-filters__search-icon" />
            <input
              id="filter-search"
              type="search"
              className="order-filters__input order-filters__input--search"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="order-filters__form-group">
          <label htmlFor="filter-status" className="order-filters__label">Estado</label>
          <select 
            id="filter-status" 
            className="order-filters__input"
            value={activeStatus}
            onChange={(e) => onStatusChange(e.target.value as OrderStatus | 'all')}
          >
            {FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="order-filters__form-group">
          <label htmlFor="filter-payment" className="order-filters__label">Forma de Pago</label>
          <select 
            id="filter-payment" 
            className="order-filters__input"
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="Cuenta Corriente">Cuenta Corriente</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>

        <div className="order-filters__form-group">
          <label htmlFor="filter-seller" className="order-filters__label">Vendedor</label>
          <select 
            id="filter-seller" 
            className="order-filters__input"
            value={seller}
            onChange={(e) => onSellerChange(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Gonzalez, Maria">Gonzalez, Maria</option>
            <option value="Ramirez, Carlos">Ramirez, Carlos</option>
            <option value="Lopez, Beatriz">Lopez, Beatriz</option>
          </select>
        </div>

        <div className="order-filters__form-group order-filters__form-group--range">
          <label className="order-filters__label">Rango de Fechas</label>
          <div className="order-filters__date-range">
            <input 
              id="filter-date-from" 
              type="date" 
              className="order-filters__input" 
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              title="Fecha Desde"
            />
            <span className="order-filters__date-separator">-</span>
            <input 
              id="filter-date-to" 
              type="date" 
              className="order-filters__input" 
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              title="Fecha Hasta"
            />
          </div>
        </div>
      </div>

      <div className="order-filters__footer">
        <p className="order-filters__count" aria-live="polite">
          Mostrando {filteredCount} de {totalCount} pedidos
        </p>
      </div>
    </div>
  );
};
