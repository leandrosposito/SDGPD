import type { ClientAccount } from '../../types/client.types';

export const CLIENTS_MOCK_DATA: ClientAccount[] = [
  {
    id: 'cli-001',
    clientName: 'Almacen La Esquina',
    zone: 'Norte',
    totalDebit: 150000,
    totalCredit: 100000,
    currentBalance: 50000,
    transactions: [
      {
        id: 'tx-101',
        date: '2026-06-10T10:00:00Z',
        type: 'invoice',
        description: 'Factura A-0001',
        debit: 50000,
        credit: 0,
        balance: 50000,
      },
      {
        id: 'tx-102',
        date: '2026-06-12T11:00:00Z',
        type: 'payment',
        description: 'Recibo X-0001',
        debit: 0,
        credit: 20000,
        balance: 30000,
      },
    ],
  },
  {
    id: 'cli-002',
    clientName: 'Supermercado Lider',
    zone: 'Centro',
    totalDebit: 500000,
    totalCredit: 500000,
    currentBalance: 0,
    transactions: [
      {
        id: 'tx-201',
        date: '2026-06-05T09:00:00Z',
        type: 'invoice',
        description: 'Factura A-0002',
        debit: 150000,
        credit: 0,
        balance: 150000,
      },
      {
        id: 'tx-202',
        date: '2026-06-11T14:30:00Z',
        type: 'payment',
        description: 'Transferencia Bancaria',
        debit: 0,
        credit: 150000,
        balance: 0,
      },
    ],
  },
];
