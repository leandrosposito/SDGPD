import { type FC } from 'react';
import type { ClientAccount } from '../../../types/client.types';

interface ClientDirectoryTableProps {
  clients: ClientAccount[];
}

export const ClientDirectoryTable: FC<ClientDirectoryTableProps> = ({ clients }) => {
  return (
    <div className="client-table-wrapper">
      <table className="client-table">
        <thead>
          <tr>
            <th>Razon Social</th>
            <th>CUIT</th>
            <th>Direccion</th>
            <th>Zona</th>
            <th>Telefono</th>
            <th>Vendedor</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(client => (
            <tr key={client.id}>
              <td className="font-medium text-primary">{client.clientName}</td>
              <td className="font-mono text-xs text-tertiary">{client.cuit}</td>
              <td>{client.address}</td>
              <td><span className="client-badge client-badge--neutral">{client.zone}</span></td>
              <td>{client.phone}</td>
              <td>{client.sellerName}</td>
              <td className="text-right">
                <div className="client-actions-row">
                  <button className="client-btn-icon" title="Nuevo Pedido">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button className="client-btn-icon client-btn-icon--success" title="Enviar WhatsApp">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-tertiary" style={{ padding: '3rem' }}>
                No se encontraron clientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
