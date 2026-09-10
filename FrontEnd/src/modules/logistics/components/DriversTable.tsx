import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Driver } from '@/shared/types/driver.types';
import './LogisticsAdminTables.css';

interface DriversTableProps {
  drivers: Driver[];
  onEdit: (driver: Driver) => void;
  onToggleActivo: (driver: Driver) => void;
}

export const DriversTable: FC<DriversTableProps> = ({ drivers, onEdit, onToggleActivo }) => {
  return (
    <Table
      data={drivers}
      keyExtractor={(d) => d.id}
      emptyMessage="No hay choferes cargados."
      columns={[
        { header: 'Nombre', accessor: 'nombre' },
        { header: 'Licencia', accessor: (d) => <span className="font-mono text-sm">{d.licencia}</span> },
        { header: 'Teléfono', accessor: 'telefono' },
        {
          header: 'Activo',
          align: 'center',
          accessor: (d) => (d.activo ? <Badge label="Activo" variant="success" /> : <Badge label="Inactivo" variant="neutral" />),
        },
        {
          header: 'Acciones',
          align: 'right',
          accessor: (d) => (
            <div className="vd-table__actions">
              <button type="button" className="vd-table__action-btn" onClick={() => onEdit(d)} aria-label={`Editar chofer ${d.nombre}`}>
                Editar
              </button>
              <button
                type="button"
                className="vd-table__action-btn"
                onClick={() => onToggleActivo(d)}
                aria-label={`${d.activo ? 'Desactivar' : 'Activar'} chofer ${d.nombre}`}
              >
                {d.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ),
        },
      ]}
    />
  );
};
