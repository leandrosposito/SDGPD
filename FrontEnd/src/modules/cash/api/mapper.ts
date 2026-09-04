import type { CashTransaction } from '@/shared/types/cash.types';
import type { CashTransactionDTO, CreateCashTransactionDTO } from './dto';

// ============================================================
// mapper.ts (cash) — Único lugar que traduce DTO↔dominio. Nada fuera
// de `cash.service.ts` lo importa (Tanda 3b, mismo criterio que
// orders/suppliers).
//
// `CashTransactionFormInput` vive ACÁ, no en `cash.service.ts` —
// mismo ciclo de import documentado en docs/GUIA_MIGRACION_MODULO.md
// ("Tropiezos concretos de la Tanda 1") que ya se evitó en orders:
// si viviera en el service, `mapper.ts` lo importaría desde ahí para
// `cashTransactionFormInputToDTO`, y como `cash.service.ts` importa
// `mapper.ts`, eso arma un ciclo.
// ============================================================

export type CashTransactionFormInput = Omit<CashTransaction, 'id'>;

export function cashTransactionFromDTO(dto: CashTransactionDTO): CashTransaction {
  return {
    id: dto.id,
    time: dto.hora,
    type: dto.tipo,
    category: dto.categoria,
    entity: dto.entidad,
    linkedVoucher: dto.comprobante,
    description: dto.descripcion,
    amount: dto.monto,
  };
}

// Usada SOLO para sembrar el mock desde data/mock/cash.data.ts
// (dominio) — un backend real nunca la necesitaría.
export function cashTransactionToDTO(tx: CashTransaction): CashTransactionDTO {
  return {
    id: tx.id,
    hora: tx.time,
    tipo: tx.type,
    categoria: tx.category,
    entidad: tx.entity,
    comprobante: tx.linkedVoucher,
    descripcion: tx.description,
    monto: tx.amount,
  };
}

export function cashTransactionFormInputToDTO(input: CashTransactionFormInput): CreateCashTransactionDTO {
  return {
    hora: input.time,
    tipo: input.type,
    categoria: input.category,
    entidad: input.entity,
    comprobante: input.linkedVoucher,
    descripcion: input.description,
    monto: input.amount,
  };
}
