import type { ClientAccount } from '@/shared/types/client.types';
import type { ClientAccountDTO, ClientFormPayloadDTO } from './dto';

// ============================================================
// mapper.ts (clients) — Único lugar que traduce DTO↔dominio para el
// Directorio de Clientes. Nada fuera de `clients.service.ts` lo
// importa.
//
// `ClientFormInput` vive ACÁ, no en `clients.service.ts` — mismo
// ciclo de import ya documentado en docs/GUIA_MIGRACION_MODULO.md
// desde Tanda 1: si viviera en el service, `mapper.ts` lo importaría
// desde ahí para `clientFormInputToDTO`, y como el service importa
// `mapper.ts`, eso arma un ciclo.
// ============================================================

export type ClientFormInput = Pick<
  ClientAccount,
  'clientName' | 'cuit' | 'address' | 'phone' | 'zone' | 'sellerName' | 'creditLimit'
>;

export function clientFromDTO(dto: ClientAccountDTO): ClientAccount {
  return {
    id: dto.id,
    clientName: dto.cliente.razon_social,
    cuit: dto.cliente.cuit,
    address: dto.cliente.direccion,
    phone: dto.cliente.telefono,
    zone: dto.cliente.zona,
    sellerName: dto.cliente.vendedor,
    creditLimit: dto.cuenta.limite_credito,
    totalDebit: dto.cuenta.total_debito,
    totalCredit: dto.cuenta.total_credito,
    currentBalance: dto.cuenta.saldo_actual,
    daysOverdue: dto.cuenta.dias_vencido,
    status: dto.cuenta.estado,
    transactions: dto.transacciones,
  };
}

// Usada SOLO para sembrar la conversión de ida y vuelta en el borde
// de fetchClients/createClient/updateClient — el store en sí sigue
// en espacio de dominio (ver clients.service.ts), no se sembró un
// store DTO aparte como en suppliers/orders/cash, porque
// getClientAccountsPage/getOverdueClientsPage comparten la MISMA
// variable de store y siguen leyéndola en forma de dominio.
export function clientToDTO(client: ClientAccount): ClientAccountDTO {
  return {
    id: client.id,
    cliente: {
      razon_social: client.clientName,
      cuit: client.cuit,
      direccion: client.address,
      telefono: client.phone,
      zona: client.zone,
      vendedor: client.sellerName,
    },
    cuenta: {
      limite_credito: client.creditLimit,
      total_debito: client.totalDebit,
      total_credito: client.totalCredit,
      saldo_actual: client.currentBalance,
      dias_vencido: client.daysOverdue,
      estado: client.status,
    },
    transacciones: client.transactions,
  };
}

export function clientFormInputToDTO(input: ClientFormInput): ClientFormPayloadDTO {
  return {
    razon_social: input.clientName,
    cuit: input.cuit,
    direccion: input.address,
    telefono: input.phone,
    zona: input.zone,
    vendedor: input.sellerName,
    limite_credito: input.creditLimit,
  };
}
