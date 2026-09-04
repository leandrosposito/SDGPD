import type { CashTransaction, ExpenseAnalysis } from '@/shared/types/cash.types';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { CASH_MOCK_DATA } from '@/data/mock/cash.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import type { CashTransactionDTO, CashPageDTO, CashAggregatesDTO } from './dto';
import { cashTransactionFromDTO, cashTransactionToDTO, cashTransactionFormInputToDTO, type CashTransactionFormInput } from './mapper';

export type { CashTransactionFormInput };

// ============================================================
// cash.service — Único punto del proyecto que habla con httpClient
// para Caja (Tanda 3b de escalabilidad). Todo lo que sale de acá ya
// está en forma de dominio — CashTransactionDTO/CashPageDTO nunca
// cruzan este archivo hacia afuera. Tercer módulo migrado sin service
// previo (segundo de esa categoría, después de orders en Tanda 3a) —
// resuelve por completo el ítem 8 de PENDIENTES.md: las mutaciones
// ahora sobreviven al desmontaje del componente porque viven en este
// store de módulo, no en el estado de React.
//
// Sin branchId (confirmado explícitamente con el usuario antes de
// implementar, no asumido — la hipótesis inicial de la tarea era que
// Caja SÍ tenía sucursal): `CashTransaction`/`CashRegister` no tienen
// ningún campo de sucursal, y a diferencia de `orders` (que al menos
// usaba `activeBranchId` transitoriamente para consultar stock), en
// `cash` no hay NINGUNA referencia a sucursal en todo el módulo. Ver
// docs/DECISIONES_TECNICAS.md para el detalle completo.
// ============================================================

export interface CashMovementsQueryFilters {
  // Todo método de este service recibe empresaId explícito desde
  // ahora (mismo criterio que orders/suppliers/products) — hoy el
  // mock no filtra por él de verdad (una sola empresa), pero el
  // contrato ya lo exige para el día que exista backend real. Sin
  // ningún otro filtro: CashPage.tsx no tenía búsqueda ni filtro de
  // tipo/categoría/fecha antes de esta tanda — no se inventan acá.
  empresaId: string;
}

// Un solo campo de orden posible hoy: CashTransactionsTable.tsx
// siempre ordenaba por hora descendente, sin control de usuario — se
// mantiene ese único orden por defecto, no se agrega un selector de
// columna que la UI original no tenía.
export type CashSortField = 'time';

// Agregados (P3, DECISIONES_TECNICAS.md): reemplazan el cálculo que
// hacía CashPage.tsx a mano, sumando incrementalmente en cada alta
// (frágil — cualquier fuente de verdad distinta de "recorrer las
// transacciones reales" puede desincronizarse). Se recalculan sobre
// TODO el store en cada consulta. `expenseAnalysis` reusa el tipo de
// dominio ya existente (`shared/types/cash.types.ts`), no se redefine.
export interface CashAggregates {
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  expenseAnalysis: ExpenseAnalysis;
}

// ------------------------------------------------------------
// "Servidor" mock — espacio DTO, sembrado una sola vez desde
// data/mock/cash.data.ts (dominio) vía cashTransactionToDTO.
// Reasignado (nunca mutado in-place) en cada escritura.
// ------------------------------------------------------------
let cashTransactionsDTOStore: CashTransactionDTO[] = CASH_MOCK_DATA.transactions.map(cashTransactionToDTO);

// Saldo inicial del día: valor fijo tomado del mock, no derivado de
// las transacciones (representa el saldo que quedó del cierre
// anterior). No existe ningún flujo de "cierre de caja" implementado
// hoy (el botón "Cierre de Caja" de CashPage.tsx es decorativo, sin
// handler, desde antes de esta tanda) — no se agrega uno acá, está
// fuera de alcance de una migración de paginación/cache.
const INITIAL_BALANCE = CASH_MOCK_DATA.initialBalance;

// Comparación "vs mes anterior": valor fijo, mismo criterio que
// FAKE_TODAY en orders.service.ts (Tanda 3a) — no hay datos de un
// período anterior en el mock para calcular una tendencia real.
const EXPENSE_TREND = {
  label: CASH_MOCK_DATA.expenseAnalysis.trendLabel,
  percentage: CASH_MOCK_DATA.expenseAnalysis.trendPercentage,
  isNegative: CASH_MOCK_DATA.expenseAnalysis.isNegativeTrend,
};

function compareByTime(a: CashTransactionDTO, b: CashTransactionDTO): number {
  return b.hora.localeCompare(a.hora); // descendente, mas reciente primero
}

// Top categorías de gasto: agrupa EGRESOS reales por categoría (antes
// era un array fijo de 3 categorías del mock, nunca recalculado) — se
// muestran todas las categorías con gasto, ordenadas de mayor a
// menor, sin un tope artificial.
function computeTopExpenseCategories(store: CashTransactionDTO[]): CashAggregatesDTO['analisis_gastos']['top_categorias'] {
  const totalsByCategory = new Map<string, number>();
  let totalExpense = 0;
  for (const dto of store) {
    if (dto.tipo !== 'expense') continue;
    totalsByCategory.set(dto.categoria, (totalsByCategory.get(dto.categoria) ?? 0) + dto.monto);
    totalExpense += dto.monto;
  }
  return [...totalsByCategory.entries()]
    .map(([categoria, monto]) => ({
      categoria,
      monto,
      porcentaje: totalExpense > 0 ? Math.round((monto / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

function computeAggregates(store: CashTransactionDTO[]): CashAggregatesDTO {
  const totalIncome = store.filter((dto) => dto.tipo === 'income').reduce((sum, dto) => sum + dto.monto, 0);
  const totalExpense = store.filter((dto) => dto.tipo === 'expense').reduce((sum, dto) => sum + dto.monto, 0);

  return {
    saldo_inicial: INITIAL_BALANCE,
    total_ingresos: totalIncome,
    total_egresos: totalExpense,
    saldo_actual: INITIAL_BALANCE + totalIncome - totalExpense,
    analisis_gastos: {
      tendencia_etiqueta: EXPENSE_TREND.label,
      tendencia_porcentaje: EXPENSE_TREND.percentage,
      tendencia_es_negativa: EXPENSE_TREND.isNegative,
      top_categorias: computeTopExpenseCategories(store),
    },
  };
}

function resolveMockCashPage(query: PageQuery<CashMovementsQueryFilters, CashSortField>): CashPageDTO {
  const aggregates = computeAggregates(cashTransactionsDTOStore);
  const sorted = [...cashTransactionsDTOStore].sort(compareByTime);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const start = (safePage - 1) * query.pageSize;

  return {
    data: sorted.slice(start, start + query.pageSize),
    meta: { total, page: safePage, page_size: query.pageSize, aggregates },
  };
}

// fetchPage de usePagedQuery — firma exacta (query, signal?), nombre
// estable (usePagedQuery usa `.name` para identificar la query en el
// cache de TanStack Query desde Tanda 2).
export async function getCashTransactionsPage(
  query: PageQuery<CashMovementsQueryFilters, CashSortField>,
  signal?: AbortSignal
): Promise<PageResult<CashTransaction, CashAggregates>> {
  const pageDTO = await httpClient.request<CashPageDTO>({
    method: 'GET',
    path: '/cash/transactions',
    params: {
      empresaId: query.filters.empresaId,
      page: query.page,
      pageSize: query.pageSize,
    },
    signal,
    mock: () => resolveMockCashPage(query),
  });

  return {
    items: pageDTO.data.map(cashTransactionFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
    aggregates: {
      initialBalance: pageDTO.meta.aggregates.saldo_inicial,
      totalIncome: pageDTO.meta.aggregates.total_ingresos,
      totalExpense: pageDTO.meta.aggregates.total_egresos,
      currentBalance: pageDTO.meta.aggregates.saldo_actual,
      expenseAnalysis: {
        trendLabel: pageDTO.meta.aggregates.analisis_gastos.tendencia_etiqueta,
        trendPercentage: pageDTO.meta.aggregates.analisis_gastos.tendencia_porcentaje,
        isNegativeTrend: pageDTO.meta.aggregates.analisis_gastos.tendencia_es_negativa,
        topCategories: pageDTO.meta.aggregates.analisis_gastos.top_categorias.map((c) => ({
          category: c.categoria,
          amount: c.monto,
          percentage: c.porcentaje,
        })),
      },
    },
  };
}

function nextTransactionId(): string {
  return `ctx-${Date.now()}`;
}

// Nuevo Movimiento de Caja. `id` lo genera el service — antes lo
// armaba CashPage.tsx#handleSaveTransaction a mano.
export async function createCashTransaction(
  empresaId: string,
  input: CashTransactionFormInput
): Promise<CashTransaction> {
  const dto = await httpClient.request<CashTransactionDTO>({
    method: 'POST',
    path: '/cash/transactions',
    body: { empresaId, ...cashTransactionFormInputToDTO(input) },
    mock: () => {
      if (!(input.amount > 0)) {
        throw new ApiError(400, 'CLIENT_ERROR', 'El monto tiene que ser mayor a cero.');
      }
      const newDTO: CashTransactionDTO = {
        id: nextTransactionId(),
        hora: input.time,
        tipo: input.type,
        categoria: input.category,
        entidad: input.entity,
        comprobante: input.linkedVoucher,
        descripcion: input.description,
        monto: input.amount,
      };
      cashTransactionsDTOStore = [newDTO, ...cashTransactionsDTOStore];
      return newDTO;
    },
  });
  return cashTransactionFromDTO(dto);
}
