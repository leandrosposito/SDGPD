// ============================================================
// SHARED TYPE DEFINITIONS — Supplier domain
// ============================================================

export interface SupplierProduct {
  id: string
  sku: string
  name: string
  category: string
  cost: number
  lastUpdate: string
}

export interface Supplier {
  id: string
  name: string
  cuit: string
  phone: string
  contactName: string
  contactEmail: string
  address: string
  city: string
  paymentTerms: string
  category: string
  pendingOrdersCount: number
  daysUntilExpiration: number | null
  currentBalance: number
  hasOverdueDebt: boolean
  products: SupplierProduct[]
  // Concurrencia optimista (ADR-BE-005): solo la trae el backend (BE-2); el mock no la usa.
  version?: number
  // purchaseOrders (SupplierPurchaseOrder embebido) se elimino (O3,
  // DECISIONES_TECNICAS.md): Compras (modules/compras/) es la unica
  // fuente de verdad para las ordenes de un proveedor. Para verlas, se
  // consulta services/mock/purchaseOrders.service#getPurchaseOrdersBySupplierId(id)
  // — ver SupplierDetailPanel.tsx.
}
