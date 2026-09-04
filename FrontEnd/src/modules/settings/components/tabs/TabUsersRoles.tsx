import { useEffect, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { Pagination } from '@/shared/components/ui/Pagination';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { PermissionMatrix } from '@/shared/types/settings.types';
import {
  getUsersPage,
  getPermissionsMatrix,
  updateRolePermission,
  type UsersQueryFilters,
} from '@/modules/settings/api/users-roles/users-roles.service';
import '@/modules/settings/SettingsPage.css';

// ============================================================
// TabUsersRoles — Usuarios y Roles (Tanda 3c de escalabilidad).
// Directorio de Usuarios: usePagedQuery (listado real, aunque chico).
// Matriz de Permisos: useCachedQuery (4 roles, siempre visible entera,
// no tiene sentido paginarla) — ver DECISIONES_TECNICAS.md.
// "Nuevo Usuario"/"Password"/"2FA"/"Guardar Matriz" siguen sin
// `onClick`: eran decorativos antes de esta tanda, no se les inventa
// una acción acá.
// ============================================================

const IconCheck: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconSquare: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  </svg>
);

// Referencia estable: ver mismo patron en otros modulos migrados.
const EMPTY_PERMISSIONS: PermissionMatrix[] = [];

export const TabUsersRoles: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const filters: UsersQueryFilters = useMemo(() => ({ empresaId: empresaId ?? '' }), [empresaId]);

  const {
    items: users,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getUsersPage, filters, { enabled: Boolean(empresaId) });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de usuarios.');
  }, [error]);

  const {
    data: permissionsData,
    isLoading: isLoadingPermissions,
    error: permissionsError,
    refetch: refetchPermissions,
  } = useCachedQuery(
    'settings-permissions-matrix',
    undefined,
    (signal) => getPermissionsMatrix(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.CATALOG, enabled: Boolean(empresaId) }
  );
  const permissions = permissionsData ?? EMPTY_PERMISSIONS;

  useEffect(() => {
    if (permissionsError) toast.error('No se pudo cargar la matriz de permisos.');
  }, [permissionsError]);

  // Reemplaza a togglePermission (mutaba SETTINGS_MOCK_PERMISSIONS
  // in-place vía una referencia compartida sin clonar, ver
  // DECISIONES_TECNICAS.md) — ahora es una mutación real contra el
  // service, con refetch() explícito de la matriz.
  const handleTogglePermission = async (matrix: PermissionMatrix, moduleKey: keyof PermissionMatrix['modules']) => {
    if (!empresaId) return;
    try {
      await updateRolePermission(empresaId, matrix.role, moduleKey, !matrix.modules[moduleKey]);
      refetchPermissions();
    } catch {
      toast.error('No se pudo actualizar el permiso.');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="settings-section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>Directorio de Usuarios</h3>
        <button className="client-modal-btn client-modal-btn--primary">Nuevo Usuario</button>
      </div>

      <div style={{ width: '100%' }}>
        {!empresaId || isLoading ? (
          <LoadingState message="Cargando usuarios..." />
        ) : error ? (
          <ErrorState message="No se pudo cargar el listado de usuarios." onRetry={refetch} />
        ) : (
          <ErrorBoundary
            fallbackTitle="No se pudo mostrar el listado de usuarios."
            fallbackMessage="Intenta de nuevo o volve al inicio."
          >
            <FetchingOverlay isFetching={isFetching}>
              <Table
                data={users}
                keyExtractor={(u) => u.id}
                columns={[
                  { header: 'Nombre', accessor: 'name' },
                  { header: 'Email', accessor: 'email' },
                  {
                    header: 'Rol',
                    accessor: (u) => <Badge label={u.role} variant={u.role === 'Admin' ? 'warning' : 'accent'} />
                  },
                  {
                    header: 'Estado',
                    accessor: (u) => <Badge label={u.status === 'active' ? 'Activo' : 'Inactivo'} variant={u.status === 'active' ? 'success' : 'danger'} />
                  },
                  {
                    header: 'Acciones',
                    align: 'right',
                    accessor: () => (
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button className="client-modal-btn client-modal-btn--outline" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }}>Password</button>
                        <button className="client-modal-btn client-modal-btn--outline" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }}>2FA</button>
                      </div>
                    )
                  }
                ]}
              />
            </FetchingOverlay>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </ErrorBoundary>
        )}
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Matriz de Permisos por Rol</h3>
      {!empresaId || isLoadingPermissions ? (
        <LoadingState message="Cargando matriz de permisos..." />
      ) : permissionsError ? (
        <ErrorState message="No se pudo cargar la matriz de permisos." onRetry={refetchPermissions} />
      ) : (
        <ErrorBoundary
          fallbackTitle="No se pudo mostrar la matriz de permisos."
          fallbackMessage="Intenta de nuevo o volve al inicio."
        >
          <div style={{ width: '100%', flexShrink: 0, overflowX: 'auto', background: 'var(--color-bg-base)', borderRadius: 'var(--radius-lg)', border: '0.0625rem solid var(--color-border)' }}>
            <table className="settings-matrix-table" style={{ minWidth: '45rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Dashboard</th>
                  <th>Pedidos</th>
                  <th>Inventario</th>
                  <th>Clientes</th>
                  <th>Proveedores</th>
                  <th>Logística</th>
                  <th>Caja</th>
                  <th>Analítica</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.role}>
                    <td>{p.role}</td>
                    {Object.entries(p.modules).map(([modName, hasAccess]) => (
                      <td key={modName}>
                        <div
                          className={`svg-checkbox ${hasAccess ? 'checked' : ''}`}
                          onClick={() => handleTogglePermission(p, modName as keyof typeof p.modules)}
                          role="checkbox"
                          aria-checked={hasAccess}
                          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        >
                          {hasAccess ? <IconCheck /> : <IconSquare />}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ErrorBoundary>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <button className="client-modal-btn client-modal-btn--primary">Guardar Matriz</button>
      </div>
    </>
  );
};
