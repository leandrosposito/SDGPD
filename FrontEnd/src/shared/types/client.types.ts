// ============================================================
// SHARED TYPE DEFINITIONS — Client domain
// ============================================================

import type { DateRangeQueryFilters } from '@/shared/types/pagination.types';

// Moneda de un importe (ISO 4217). El mock incluye ARS y USD (C1,
// DECISIONES_TECNICAS.md) para poder probar que los importes se
// agrupan por moneda en vez de sumarse (M5): sumar pesos con dolares
// daria un numero inventado. No se implementa conversion ni cotizacion
// (fuera de alcance) — un cliente que debe en dos monedas simplemente
// muestra dos importes, nunca un total combinado.
export type Currency = 'ARS' | 'USD';

interface ClientTransactionBase {
  id: string;
  date: string;
  description: string;
  debit: number; // Debe (Aumenta deuda)
  credit: number; // Haber (Reduce deuda)
  balance: number; // Saldo acumulado de la cuenta a esta transaccion
  currency: Currency;
}

// dueDate (vencimiento) solo existe en las facturas (M1,
// DECISIONES_TECNICAS.md): son el unico tipo de comprobante que vence.
// Union discriminada por `type` en vez de un dueDate opcional en la
// base — un pago o un ajuste con dueDate undefined "porque no aplica"
// es un campo que miente por omision; que TypeScript directamente no
// permita escribirlo en esos dos casos es mas honesto que dejarlo
// opcional y confiar en que nadie lo llene por error.
export interface ClientInvoiceTransaction extends ClientTransactionBase {
  type: 'invoice';
  dueDate: string;
}

export interface ClientPaymentTransaction extends ClientTransactionBase {
  type: 'payment';
}

export interface ClientAdjustmentTransaction extends ClientTransactionBase {
  type: 'adjustment';
}

export type ClientTransaction =
  | ClientInvoiceTransaction
  | ClientPaymentTransaction
  | ClientAdjustmentTransaction;

export interface ClientAccount {
  id: string;
  clientName: string;
  cuit: string;
  address: string;
  phone: string;
  zone: string;
  sellerName: string;
  creditLimit: number;
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
  daysOverdue: number;
  status: 'Al dia' | 'Con Deuda';
  transactions: ClientTransaction[];
}

// ============================================================
// Deuda vencida / aging (M1-M4, DECISIONES_TECNICAS.md) — tipos para
// la vista de cobranzas (tab "Clientes Morosos"). Son conceptos
// derivados de la imputacion FIFO de pagos/ajustes-credito contra las
// facturas, no campos del mock — ver
// services/mock/clients.service.ts#getOverdueClientsPage.
// ============================================================

export type AgingBucket = '1-30' | '31-60' | '61-90' | '90+';

// Una factura despues de la imputacion FIFO (M2): `openBalance` es lo
// que todavia debe ESA factura puntual, no el saldo total de la
// cuenta. openBalance > 0 y vencida (dueDate en el pasado) es lo que
// hace a un cliente "moroso" para esta vista — no se deriva de
// ClientAccount.status (M8).
export interface OpenInvoice {
  transactionId: ClientTransaction['id'];
  dueDate: string;
  originalAmount: number;
  openBalance: number;
  currency: Currency;
  daysOverdue: number; // 0 si todavia no vencio
  bucket: AgingBucket | null; // null si no vencio (M3): no entra en ningun tramo
}

// dateFrom/dateTo (DateRangeFilter, tarea transversal) filtran por
// `dueDate` de las facturas VENCIDAS — es una dimension ADICIONAL e
// independiente del tramo de aging (`bucket`), que sigue siendo un
// calculo relativo a HOY sin tocar: los dos conviven (ej. "tramo 31-60
// dias" + "vencimiento entre el 1 y el 15 de agosto" son dos filtros
// simultaneos sobre el mismo conjunto de facturas abiertas).
export interface OverdueClientsQueryFilters extends DateRangeQueryFilters {
  search?: string; // nombre o CUIT (M6)
  bucket?: AgingBucket; // filtro por tramo de mayor antiguedad del cliente
}

export type OverdueClientsSortField = 'clientName' | 'overdueAmount' | 'oldestDueDate';

// Monto vencido en UNA moneda (C1, DECISIONES_TECNICAS.md). Nunca se
// suman dos entradas de este tipo entre si si tienen distinta
// `currency` — para eso esta el array en OverdueClientRow, no un campo
// numerico suelto.
export interface OverdueAmountByCurrency {
  currency: Currency;
  amount: number;
}

// Fila de la tabla de cobranzas: UN cliente con al menos una factura
// vencida y abierta (C1, DECISIONES_TECNICAS.md — "una fila o dos"
// para un cliente que debe en varias monedas: se decidio UNA fila por
// cliente, porque en esta vista el cliente es la unidad de gestion de
// cobranzas — buscar/paginar/filtrar opera sobre clientes, no sobre
// pares cliente+moneda, y duplicar la fila haria que `totalItems`
// dejara de ser "cantidad de clientes morosos"). Lo que varia por
// moneda es el MONTO (overdueByCurrency), nunca la identidad de la
// fila.
//
// oldestOverdueDays/oldestBucket son del CLIENTE, no de una moneda en
// particular: la factura vencida hace mas tiempo determina la urgencia
// de cobranza sin importar en que moneda esta expresada — la
// antiguedad se mide en dias, no en dinero, asi que mezclar monedas ahi
// no es un problema (a diferencia de sumar montos).
export interface OverdueClientRow {
  clientId: ClientAccount['id'];
  clientName: string;
  cuit: string;
  overdueByCurrency: OverdueAmountByCurrency[]; // suma SOLO facturas vencidas (M3), agrupadas por moneda (M5), nunca sumadas entre si
  oldestOverdueDays: number;
  oldestBucket: AgingBucket;
  creditLimit: number;
  currentBalance: number;
}

// Agregados de aging (M4): totales por tramo, nunca calculados sobre
// la pagina. Un tramo se repite una vez por moneda presente en el —
// hoy siempre 'ARS' (M5). clientCount cuenta clientes distintos con al
// menos una factura vencida en ESE tramo (un cliente con facturas en
// dos tramos cuenta en los dos, igual que un reporte de antiguedad de
// saldos tradicional).
export interface AgingBucketAggregate {
  bucket: AgingBucket;
  currency: Currency;
  totalOverdue: number;
  clientCount: number;
}

export interface OverdueClientsAggregates {
  byBucket: AgingBucketAggregate[];
}
