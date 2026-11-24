import type { Branch } from '@/shared/types/session.types'

export type StockedProductSortField = 'sku' | 'name' | 'stock' | 'minStock'

export interface StockedProductsQueryFilters {
  empresaId: string
  branchId: Branch['id']
  search?: string
}

// Agregados (P3): reemplazan el cálculo que hacía TabStockCurrent.tsx
// en memoria sobre el array completo (totalProducts/lowStock/
// outOfStock/totalValue) — se calculan sobre TODO lo que matchea la
// búsqueda vigente en la sucursal, nunca sobre `items` de la página.
export interface StockAggregates {
  totalProducts: number
  lowStock: number
  outOfStock: number
  totalValue: number
}

// `search` agregado (hallazgo funcional post-Tanda 3e): esta tab no
// tenía búsqueda propia. Reusa `matchesSearch` (arriba, misma función
// que `getStockedProductsPage`) — mismos 4 campos (sku/código de
// barras/nombre/descripción), no se reimplementa el predicado.
export interface LowStockQueryFilters {
  empresaId: string
  branchId: Branch['id']
  search?: string
}

// `deficit` agregado (`stock_minimo - stock`, "cuánto falta para llegar
// al mínimo"): no existe en `StockedProductSortField` (Stock Actual no
// tiene esa columna) — se extiende el tipo en vez de tocar el de Stock
// Actual, para no ofrecerle un orden que no tiene sentido ahí.
export type LowStockSortField = StockedProductSortField | 'deficit'
