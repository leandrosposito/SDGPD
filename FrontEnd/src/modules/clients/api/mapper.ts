import type { ClientAccount } from '@/shared/types/client.types';
import { asClientId } from '@/shared/types/ids.types';
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
  | 'clientName'
  | 'cuit'
  | 'address'
  | 'phone'
  | 'zone'
  | 'sellerName'
  | 'creditLimit'
  | 'priceList'
  | 'saleCondition'
  | 'tradeName'
  | 'ivaCondition'
  | 'email'
  | 'googleMapsLink'
  | 'deliveryAddressSameAsFiscal'
  | 'deliveryAddress'
  | 'deliveryReferences'
  | 'businessCategory'
  | 'notes'
  | 'isActive'
>;

export function clientFromDTO(dto: ClientAccountDTO): ClientAccount {
  return {
    id: asClientId(dto.id),
    clientName: dto.cliente.razon_social,
    cuit: dto.cliente.cuit,
    address: dto.cliente.direccion,
    phone: dto.cliente.telefono,
    zone: dto.cliente.zona,
    sellerName: dto.cliente.vendedor,
    tradeName: dto.cliente.nombre_fantasia,
    ivaCondition: dto.cliente.condicion_iva,
    email: dto.cliente.email,
    googleMapsLink: dto.cliente.google_maps_link,
    deliveryAddressSameAsFiscal: dto.cliente.direccion_entrega_igual_fiscal,
    deliveryAddress: dto.cliente.direccion_entrega,
    deliveryReferences: dto.cliente.referencias_entrega,
    creditLimit: dto.cuenta.limite_credito,
    priceList: dto.cuenta.lista_precios,
    saleCondition: dto.cuenta.condicion_venta,
    businessCategory: dto.cuenta.categoria,
    notes: dto.cuenta.notas,
    isActive: dto.cuenta.activo,
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
      nombre_fantasia: client.tradeName,
      condicion_iva: client.ivaCondition,
      email: client.email,
      google_maps_link: client.googleMapsLink,
      direccion_entrega_igual_fiscal: client.deliveryAddressSameAsFiscal,
      direccion_entrega: client.deliveryAddress,
      referencias_entrega: client.deliveryReferences,
    },
    cuenta: {
      limite_credito: client.creditLimit,
      lista_precios: client.priceList,
      condicion_venta: client.saleCondition,
      categoria: client.businessCategory,
      notas: client.notes,
      activo: client.isActive,
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
    lista_precios: input.priceList,
    condicion_venta: input.saleCondition,
    nombre_fantasia: input.tradeName,
    condicion_iva: input.ivaCondition,
    email: input.email,
    google_maps_link: input.googleMapsLink,
    direccion_entrega_igual_fiscal: input.deliveryAddressSameAsFiscal,
    direccion_entrega: input.deliveryAddress,
    referencias_entrega: input.deliveryReferences,
    categoria: input.businessCategory,
    notas: input.notes,
    activo: input.isActive,
  };
}
