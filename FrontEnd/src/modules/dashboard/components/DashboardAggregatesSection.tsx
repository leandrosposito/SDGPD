import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, ListChecks, AlertCircle, Building2 } from 'lucide-react';
import type { OrderStatus } from '@/shared/types/order.types';
import { isBranchId } from '@/shared/types/ids.types';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { formatMoney } from '@/shared/utils/money';
import { useDashboardAggregates } from '../hooks/useDashboardAggregates';
import './DashboardAggregatesSection.css';

// ============================================================
// DashboardAggregatesSection — Tanda 7 de la corrida completa; ADR-009
// agrega el selector de alcance (sucursal / toda la empresa) elegido
// por el usuario. Seccion NUEVA del tablero (ventas por zona, pedidos
// por estado del periodo, cuentas por cobrar vencidas, link a
// pendientes de preparacion) — se agrega AL LADO de KpiGrid/
// SalesChart/etc. existentes, sin tocarlos.
//
// "Nunca dos fuentes de verdad" (ADR-009): el encabezado dice el
// alcance elegido, y CADA tarjeta repite su propio alcance real —
// Cuentas por Cobrar es EMPRESA-ONLY siempre (no tiene relacion con
// sucursal en el modelo, ver dashboardAggregates.service.ts), asi que
// su rotulo es fijo sin importar que sucursal este seleccionada en el
// dropdown.
// ============================================================

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  dispatched: 'Despachado',
  delivered: 'Entregado',
  invoiced: 'Facturado',
  cancelled: 'Cancelado',
};

const EMPRESA_LABEL = 'Toda la empresa';

export const DashboardAggregatesSection: FC = () => {
  const session = useSessionStore((s) => s.session);
  const { data, isLoading, error, resolvedBranchId, isExplicitAll, setBranchFilter } = useDashboardAggregates();

  const scopeLabel = resolvedBranchId
    ? (session?.branches.find((b) => b.id === resolvedBranchId)?.name ?? 'Sucursal')
    : EMPRESA_LABEL;

  function handleScopeChange(value: string) {
    if (value === 'all') {
      setBranchFilter('all');
    } else if (value === '') {
      // "Seguir sucursal activa": borra el filtro propio del tablero,
      // vuelve a resolver desde el selector global (ver ADR-009).
      setBranchFilter(undefined);
    } else if (isBranchId(value)) {
      setBranchFilter(value);
    }
    // Cualquier otro valor (no deberia ocurrir: las opciones del
    // <select> solo se arman desde session.branches, ids reales) se
    // ignora en silencio en vez de escribir basura a la URL.
  }

  // Valor mostrado en el dropdown: 'all' solo si el usuario lo eligio
  // EXPLICITAMENTE (no si empresa completa es el resultado por falta
  // de sucursal activa) — evita el bug de mostrar "Seguir sucursal
  // activa" seleccionado cuando en realidad el filtro aplicado es
  // "toda la empresa" a proposito.
  const selectValue = isExplicitAll ? 'all' : (resolvedBranchId ?? '');

  const scopeSelector = (
    <label className="dashboard-aggregates__scope">
      <Building2 size={14} aria-hidden="true" />
      <select
        className="dashboard-aggregates__scope-select"
        aria-label="Alcance de los agregados del tablero"
        value={selectValue}
        onChange={(e) => handleScopeChange(e.target.value)}
      >
        <option value="">Seguir sucursal activa</option>
        <option value="all">Toda la empresa</option>
        {session?.branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (isLoading) {
    return (
      <section className="dashboard-aggregates" aria-label="Agregados del periodo">
        <div className="dashboard-aggregates__header">
          <h3 className="dashboard-aggregates__heading">Agregados — Mostrando: {scopeLabel}</h3>
          {scopeSelector}
        </div>
        <div className="dashboard-aggregates__loading">Cargando agregados...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="dashboard-aggregates" aria-label="Agregados del periodo">
        <div className="dashboard-aggregates__header">
          <h3 className="dashboard-aggregates__heading">Agregados — Mostrando: {scopeLabel}</h3>
          {scopeSelector}
        </div>
        <div className="dashboard-aggregates__loading">No se pudieron cargar los agregados del periodo.</div>
      </section>
    );
  }

  const pendingCount = data.ordersByStatus.find((row) => row.status === 'pending')?.cantidad ?? 0;

  return (
    <section className="dashboard-aggregates" aria-label="Agregados del periodo">
      <div className="dashboard-aggregates__header">
        <h3 className="dashboard-aggregates__heading">Agregados — Mostrando: {scopeLabel}</h3>
        {scopeSelector}
      </div>

      <div className="dashboard-aggregates__grid">
        <div className="dashboard-aggregates__card">
          <div className="dashboard-aggregates__card-title">
            <MapPin size={16} aria-hidden="true" /> Ventas por zona
          </div>
          <p className="dashboard-aggregates__card-scope">{scopeLabel}</p>
          {data.salesByZone.length === 0 ? (
            <p className="dashboard-aggregates__empty">Sin ventas registradas.</p>
          ) : (
            <ul className="dashboard-aggregates__list">
              {data.salesByZone.map((row) => (
                <li key={row.zone} className="dashboard-aggregates__row">
                  <span>{row.zone}</span>
                  <span className="dashboard-aggregates__row-value">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(row.totalVentas)}
                    <small> ({row.cantidadPedidos})</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-aggregates__card">
          <div className="dashboard-aggregates__card-title">
            <ListChecks size={16} aria-hidden="true" /> Pedidos por estado
          </div>
          <p className="dashboard-aggregates__card-scope">{scopeLabel}</p>
          {data.ordersByStatus.length === 0 ? (
            <p className="dashboard-aggregates__empty">Sin pedidos en el periodo.</p>
          ) : (
            <ul className="dashboard-aggregates__list">
              {data.ordersByStatus.map((row) => (
                <li key={row.status} className="dashboard-aggregates__row">
                  <span>{STATUS_LABEL[row.status]}</span>
                  <span className="dashboard-aggregates__row-value">{row.cantidad}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-aggregates__card">
          <div className="dashboard-aggregates__card-title">
            <AlertCircle size={16} aria-hidden="true" /> Cuentas por cobrar vencidas
          </div>
          {/* ADR-009: EMPRESA-ONLY siempre, rotulo fijo — nunca sigue al
              selector de arriba, no tiene relacion con sucursal en el modelo. */}
          <p className="dashboard-aggregates__card-scope">{EMPRESA_LABEL} (no se puede filtrar por sucursal)</p>
          {data.overdueTotals.length === 0 ? (
            <p className="dashboard-aggregates__empty">Sin cuentas vencidas.</p>
          ) : (
            <ul className="dashboard-aggregates__list">
              {data.overdueTotals.map((total) => (
                <li key={total.moneda} className="dashboard-aggregates__row">
                  <span>{total.moneda}</span>
                  <span className="dashboard-aggregates__row-value">{formatMoney(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link to="/pedidos?status=pending" className="dashboard-aggregates__card dashboard-aggregates__card--link">
          <div className="dashboard-aggregates__card-title">Pedidos pendientes de preparacion</div>
          <div className="dashboard-aggregates__big-number">
            {pendingCount}
            <ArrowRight size={18} aria-hidden="true" />
          </div>
          <p className="dashboard-aggregates__empty">Ver listado filtrado</p>
        </Link>
      </div>
    </section>
  );
};
