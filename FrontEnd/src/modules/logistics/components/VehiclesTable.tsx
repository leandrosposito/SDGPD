import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Vehicle } from '@/shared/types/vehicle.types';
import './LogisticsAdminTables.css';

interface VehiclesTableProps {
  vehicles: Vehicle[];
  onEdit: (vehicle: Vehicle) => void;
  onToggleActivo: (vehicle: Vehicle) => void;
}

export const VehiclesTable: FC<VehiclesTableProps> = ({ vehicles, onEdit, onToggleActivo }) => {
  return (
    <Table
      data={vehicles}
      keyExtractor={(v) => v.id}
      emptyMessage="No hay vehículos cargados."
      columns={[
        { header: 'Patente', accessor: (v) => <span className="font-mono text-sm">{v.patente}</span> },
        { header: 'Tipo', accessor: 'tipo' },
        { header: 'Bultos', align: 'center', accessor: (v) => v.capacidad.bultos },
        { header: 'Peso (kg)', align: 'center', accessor: (v) => v.capacidad.pesoKg },
        { header: 'Volumen (m³)', align: 'center', accessor: (v) => v.capacidad.volumenM3 },
        {
          header: 'Refrigerado',
          align: 'center',
          accessor: (v) => (v.capacidad.refrigerado ? <Badge label="Sí" variant="info" /> : <span className="text-tertiary text-sm">No</span>),
        },
        { header: 'Zonas', accessor: (v) => v.capacidad.zonasHabilitadas.join(', ') },
        {
          header: 'Activo',
          align: 'center',
          accessor: (v) => (v.activo ? <Badge label="Activo" variant="success" /> : <Badge label="Inactivo" variant="neutral" />),
        },
        {
          header: 'Acciones',
          align: 'right',
          accessor: (v) => (
            <div className="vd-table__actions">
              <button type="button" className="vd-table__action-btn" onClick={() => onEdit(v)} aria-label={`Editar vehículo ${v.patente}`}>
                Editar
              </button>
              <button
                type="button"
                className="vd-table__action-btn"
                onClick={() => onToggleActivo(v)}
                aria-label={`${v.activo ? 'Desactivar' : 'Activar'} vehículo ${v.patente}`}
              >
                {v.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ),
        },
      ]}
    />
  );
};
