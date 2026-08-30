import type { FC } from 'react';
import { Filter } from 'lucide-react';
import type { Delivery, DeliveryStatus } from '../../../shared/types/logistics.types';
import { DELIVERY_STATUS_LABEL } from '../deliveryStatusLabels';
import './DeliveryFilters.css';

// ============================================================
// DeliveryFilters — Filtro rapido de entregas por estado
// ============================================================

export type DeliveryStatusFilter = DeliveryStatus | 'all';

interface DeliveryFiltersProps {
  deliveries: Delivery[];
  activeStatus: DeliveryStatusFilter;
  onStatusChange: (status: DeliveryStatusFilter) => void;
}

const STATUS_ORDER: DeliveryStatus[] = ['pending', 'in_transit', 'delivered'];

export const DeliveryFilters: FC<DeliveryFiltersProps> = ({
  deliveries,
  activeStatus,
  onStatusChange,
}) => {
  const options: { value: DeliveryStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todas', count: deliveries.length },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: DELIVERY_STATUS_LABEL[status],
      count: deliveries.filter((d) => d.status === status).length,
    })),
  ];

  return (
    <div className="delivery-filters" role="group" aria-label="Filtrar entregas por estado">
      <span className="delivery-filters__icon" aria-hidden="true">
        <Filter size={16} />
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`delivery-filters__btn${
            activeStatus === opt.value ? ' delivery-filters__btn--active' : ''
          }`}
          aria-pressed={activeStatus === opt.value}
          onClick={() => onStatusChange(opt.value)}
        >
          {opt.label}
          <span className="delivery-filters__count">{opt.count}</span>
        </button>
      ))}
    </div>
  );
};
