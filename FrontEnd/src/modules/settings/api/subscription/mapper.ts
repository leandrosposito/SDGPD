import type { InvoiceRecord } from '@/shared/types/settings.types';
import type { InvoiceRecordDTO } from './dto';

// ============================================================
// mapper.ts (settings/subscription) — Único lugar que traduce
// DTO↔dominio para el Historial de Cobros. Nada fuera de
// `subscription.service.ts` lo importa.
// ============================================================

export function invoiceFromDTO(dto: InvoiceRecordDTO): InvoiceRecord {
  return {
    id: dto.id,
    date: dto.fecha,
    amount: dto.monto,
    status: dto.estado,
    plan: dto.plan,
  };
}

// Usada SOLO para sembrar el mock desde data/mock/settings.data.ts.
export function invoiceToDTO(invoice: InvoiceRecord): InvoiceRecordDTO {
  return {
    id: invoice.id,
    fecha: invoice.date,
    monto: invoice.amount,
    estado: invoice.status,
    plan: invoice.plan,
  };
}
