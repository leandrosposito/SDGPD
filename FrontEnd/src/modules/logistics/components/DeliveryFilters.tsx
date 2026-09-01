import type { FC } from 'react';
import { Filter } from 'lucide-react';
import type { DeliveryStatus } from '@/shared/types/logistics.types';
import type { DeliveryAggregates } from '../services/deliveries.service';
import { DELIVERY_STATUS_LABEL } from '../deliveryStatusLabels';
import './DeliveryFilters.css';

// ============================================================
// DeliveryFilters — Filtro rapido de entregas por estado. Los contadores
// por opcion salen de `aggregates` (P3): son la cantidad de entregas de
// hoy en esta sucursal en cada estado, calculada por el servicio sobre
// TODO el scope (no sobre la pagina actual) y sin aplicar el filtro de
// estado — asi no cambian segun cual opcion este seleccionada.
// ============================================================

export type DeliveryStatusFilter = DeliveryStatus | 'all';

interface DeliveryFiltersProps {
  aggregates: DeliveryAggregates | undefined;
  activeStatus: DeliveryStatusFilter;
  onStatusChange: (status: DeliveryStatusFilter) => void;
}

const STATUS_ORDER: DeliveryStatus[] = ['pending', 'in_transit', 'delivered'];

export const DeliveryFilters: FC<DeliveryFiltersProps> = ({
  aggregates,
  activeStatus,
  onStatusChange,
}) => {
  const countByStatus = aggregates?.countByStatus;
  const options: { value: DeliveryStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todas', count: aggregates?.totalForScope ?? 0 },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: DELIVERY_STATUS_LABEL[status],
      count: countByStatus?.[status] ?? 0,
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
