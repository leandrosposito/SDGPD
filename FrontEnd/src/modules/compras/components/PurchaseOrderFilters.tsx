import { type FC } from 'react';
import { Search } from 'lucide-react';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { PurchaseOrderStatus } from '@/shared/types/purchaseOrder.types';
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_ORDER } from '../purchaseOrderLabels';

// ============================================================
// PurchaseOrderFilters — barra de filtros de Compras (O8): busqueda
// (server-side, debounced desde ComprasPage — este componente solo
// controla el valor crudo del input, mismo patron que ClientFilters),
// proveedor/estado/sucursal como selects de ID exacto.
// ============================================================

interface PurchaseOrderFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  supplierId: string;
  onSupplierChange: (value: string) => void;
  status: PurchaseOrderStatus | '';
  onStatusChange: (value: PurchaseOrderStatus | '') => void;
  branchId: string;
  onBranchChange: (value: string) => void;
  suppliers: Supplier[];
  branches: Branch[];
}

export const PurchaseOrderFilters: FC<PurchaseOrderFiltersProps> = ({
  searchQuery,
  onSearchChange,
  supplierId,
  onSupplierChange,
  status,
  onStatusChange,
  branchId,
  onBranchChange,
  suppliers,
  branches,
}) => {
  return (
    <div className="compras-filters">
      <div className="compras-filters__search">
        <Search className="compras-filters__search-icon" size={18} aria-hidden="true" />
        <input
          type="text"
          className="compras-filters__input compras-filters__input--search"
          placeholder="Buscar por numero de OC..."
          aria-label="Buscar por numero de orden de compra"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="compras-filters__group">
        <label className="compras-filters__label" htmlFor="compras-filter-supplier">Proveedor</label>
        <select
          id="compras-filter-supplier"
          className="compras-filters__input"
          value={supplierId}
          onChange={(e) => onSupplierChange(e.target.value)}
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="compras-filters__group">
        <label className="compras-filters__label" htmlFor="compras-filter-status">Estado</label>
        <select
          id="compras-filter-status"
          className="compras-filters__input"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PurchaseOrderStatus | '')}
        >
          <option value="">Todos los estados</option>
          {PURCHASE_ORDER_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{PURCHASE_ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <div className="compras-filters__group">
        <label className="compras-filters__label" htmlFor="compras-filter-branch">Sucursal</label>
        <select
          id="compras-filter-branch"
          className="compras-filters__input"
          value={branchId}
          onChange={(e) => onBranchChange(e.target.value)}
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
