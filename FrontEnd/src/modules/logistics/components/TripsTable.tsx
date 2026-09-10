import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Trip } from '@/shared/types/trip.types';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { Driver } from '@/shared/types/driver.types';
import { TRIP_STATUS_LABEL, TRIP_STATUS_VARIANT } from '../tripStatusLabels';
import './LogisticsAdminTables.css';

interface TripsTableProps {
  trips: Trip[];
  vehiclesById: Map<string, Vehicle>;
  driversById: Map<string, Driver>;
  onRowClick: (trip: Trip) => void;
}

export const TripsTable: FC<TripsTableProps> = ({ trips, vehiclesById, driversById, onRowClick }) => {
  return (
    <Table
      data={trips}
      keyExtractor={(t) => t.id}
      emptyMessage="No hay viajes para los filtros seleccionados."
      columns={[
        { header: 'Código', accessor: (t) => <span className="font-mono text-sm">{t.id}</span> },
        { header: 'Fecha', accessor: (t) => t.fecha },
        { header: 'Vehículo', accessor: (t) => vehiclesById.get(t.vehicleId)?.patente ?? t.vehicleId },
        { header: 'Chofer', accessor: (t) => driversById.get(t.driverId)?.nombre ?? t.driverId },
        {
          header: 'Estado',
          align: 'center',
          accessor: (t) => (
            <div className="vd-table__actions" style={{ justifyContent: 'center' }}>
              <Badge label={TRIP_STATUS_LABEL[t.estado]} variant={TRIP_STATUS_VARIANT[t.estado]} />
              {t.sobrecargado && <Badge label="Sobrecargado" variant="warning" />}
            </div>
          ),
        },
        { header: 'Paradas', align: 'center', accessor: (t) => t.paradas.length },
        { header: 'Entregas', align: 'center', accessor: (t) => t.paradas.reduce((sum, s) => sum + s.deliveryIds.length, 0) },
        {
          header: '',
          align: 'right',
          accessor: (t) => (
            <button type="button" className="vd-table__action-btn" onClick={() => onRowClick(t)} aria-label={`Ver detalle del viaje ${t.id}`}>
              Ver detalle
            </button>
          ),
        },
      ]}
    />
  );
};
