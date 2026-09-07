import { type FC } from 'react';
import { ExportButton, type ExportColumn, type ExportFetchResult } from '@/shared/components/ui/ExportButton';
import type { ClientAccount } from '@/shared/types/client.types';

interface ClientActionBarProps {
  onNewClient: () => void;
  exportColumns: ExportColumn<ClientAccount>[];
  exportRows: () => Promise<ExportFetchResult<ClientAccount>>;
}

// El boton "Exportar a Excel" era decorativo (sin onClick) desde antes
// de esta tanda — se reemplaza por el ExportButton real (Tanda C1,
// AUDIT_2026-09-07_conexion-export-3fg.md), mismo componente
// compartido que el resto de los listados de la app.
export const ClientActionBar: FC<ClientActionBarProps> = ({ onNewClient, exportColumns, exportRows }) => {
  return (
    <div className="client-action-bar">
      <ExportButton fileNamePrefix="directorio-clientes" columns={exportColumns} fetchRows={exportRows} />
      <button className="client-modal-btn client-modal-btn--primary" onClick={onNewClient}>
        Nuevo Cliente
      </button>
    </div>
  );
};
