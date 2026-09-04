import type { TransactionType, TransactionCategory } from '@/shared/types/cash.types';

// ============================================================
// dto.ts (cash) — Forma que tendría la respuesta de un backend real
// (Tanda 3b de escalabilidad). Deliberadamente DISTINTA del dominio
// (`shared/types/cash.types.ts`): snake_case y campos agrupados, mismo
// criterio que `OrderDTO`/`SupplierDTO`. `tipo`/`categoria` mantienen
// los valores del enum tal cual (mismo criterio que `estado` en
// `OrderDTO`) — solo cambian los NOMBRES de campo, no los valores.
// ============================================================

export interface CashTransactionDTO {
  id: string;
  hora: string;
  tipo: TransactionType;
  categoria: TransactionCategory;
  entidad?: string;
  comprobante?: string;
  descripcion: string;
  monto: number;
}

export interface CashTopCategoryDTO {
  categoria: string;
  monto: number;
  porcentaje: number;
}

// Agregados (P3, DECISIONES_TECNICAS.md): saldo inicial/ingresos/
// egresos/saldo actual se calculan sobre TODAS las transacciones del
// store, nunca sobre `data` de la página — antes de esta tanda,
// CashPage.tsx los mantenía a mano, sumando incrementalmente en cada
// alta (frágil: cualquier fuente de verdad distinta a "recorrer las
// transacciones reales" puede desincronizarse). `analisis_gastos.top_categorias`
// también se calcula de verdad, agrupando egresos reales por
// categoría — antes era un array fijo del mock, nunca recalculado.
// `tendencia_*` (comparación "vs mes anterior") sigue siendo un valor
// fijo: no hay datos de un período anterior en el mock para comparar
// de verdad — mismo criterio que FAKE_TODAY en orders.service.ts
// (Tanda 3a): un hack preexistente que esta tanda no corrige, es de
// paginación/cache, no de esa lógica de negocio.
export interface CashAggregatesDTO {
  saldo_inicial: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_actual: number;
  analisis_gastos: {
    tendencia_etiqueta: string;
    tendencia_porcentaje: number;
    tendencia_es_negativa: boolean;
    top_categorias: CashTopCategoryDTO[];
  };
}

// Envoltorio de lista — { data, meta } genérico del proyecto, con
// `aggregates` dentro de `meta` (misma extensión que `OrdersPageDTO`).
export interface CashPageDTO {
  data: CashTransactionDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    aggregates: CashAggregatesDTO;
  };
}

// Payload de alta (Nuevo Movimiento de Caja). Solo los campos que el
// formulario pide — `id` lo genera el service.
export interface CreateCashTransactionDTO {
  hora: string;
  tipo: TransactionType;
  categoria: TransactionCategory;
  entidad?: string;
  comprobante?: string;
  descripcion: string;
  monto: number;
}
