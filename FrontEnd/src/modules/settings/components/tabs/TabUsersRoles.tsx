import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import type { Branch, Role, User } from '@sdgpd/contracts';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { usePermission } from '@/shared/auth/usePermission';
import {
  exportUsers,
  getBranches,
  getRoles,
  getUsersPage,
  usersExportAvailable,
  type UsersQueryFilters,
} from '@/modules/settings/api/users-roles/users-roles.service';
import { UserFormModal } from '@/modules/settings/components/users-roles/UserFormModal';
import { RolePermissionsEditor } from '@/modules/settings/components/users-roles/RolePermissionsEditor';
import '@/modules/settings/SettingsPage.css';

// ============================================================
// TabUsersRoles — Usuarios y Roles (BE-1b, conectado a /api/users y
// /api/roles cuando 'users'/'roles' van por http; si no, el mock del
// service con las mismas reglas).
// - Directorio paginado (usePagedQuery), con rol, estado y sucursales.
// - Alta y edicion (UserFormModal): rol, activo y sucursales, con version.
//   La clave de idempotencia se genera AL ABRIR el formulario.
// - Matriz modulo × accion de 10 modulos (RolePermissionsEditor).
// - Los botones se ocultan por permiso (settings.crear / settings.editar);
//   la autorizacion la hace el servidor.
// - Errores 409 version-conflict y 422 last-admin con mensaje claro
//   (settingsErrors.ts); un 409 recarga lo que se muestra.
// ============================================================

const EMPTY_ROLES: Role[] = [];
const EMPTY_BRANCHES: Branch[] = [];

type FormState = { mode: 'create' } | { mode: 'edit'; user: User };

export const TabUsersRoles: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const sessionUserId = useSessionStore((s) => s.session?.id);
  const sessionRoleId = useSessionStore((s) => s.session?.role.id);
  const refreshSession = useSessionStore((s) => s.refreshSession);
  // Sin settings.ver el backend responde 403 a /api/users y /api/roles: no se
  // consulta nada y se muestra un aviso (la autorizacion sigue en el servidor).
  const canView = usePermission('settings', 'ver');
  const canCreate = usePermission('settings', 'crear');
  const canEdit = usePermission('settings', 'editar');

  // Tanda 4 (corrida completa, A13): pagina en la URL, prefijo `usr_`.
  const urlState = useUrlListState({ prefix: 'usr' });
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
  } = usePagedQuery(getUsersPage, filters, {
    enabled: Boolean(empresaId) && canView,
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de usuarios.');
  }, [error]);

  const {
    data: rolesData,
    isLoading: isLoadingRoles,
    error: rolesError,
    refetch: refetchRoles,
  } = useCachedQuery('settings-roles', undefined, (signal) => getRoles(signal), {
    staleTime: CACHE_STALE_TIME.CATALOG,
    enabled: Boolean(empresaId) && canView,
  });
  const roles = rolesData ?? EMPTY_ROLES;

  const { data: branchesData } = useCachedQuery('settings-branches', undefined, (signal) => getBranches(signal), {
    staleTime: CACHE_STALE_TIME.CATALOG,
    enabled: Boolean(empresaId) && canView && (canCreate || canEdit),
  });
  const branches = branchesData ?? EMPTY_BRANCHES;

  useEffect(() => {
    if (rolesError) toast.error('No se pudo cargar la matriz de permisos.');
  }, [rolesError]);

  // Formulario abierto + su clave de idempotencia, generada al abrirlo.
  const [form, setForm] = useState<(FormState & { idempotencyKey: string }) | null>(null);
  const openCreate = () => setForm({ mode: 'create', idempotencyKey: crypto.randomUUID() });
  const openEdit = (user: User) => setForm({ mode: 'edit', user, idempotencyKey: crypto.randomUUID() });

  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? '—';
  const branchNames = (ids: string[]) =>
    ids.length === 0 ? 'Ninguna' : ids.map((id) => branches.find((b) => b.id === id)?.code ?? id.slice(0, 8)).join(', ');

  const handleUserSaved = (saved: User) => {
    setForm(null);
    refetch();
    // Cambiar el propio rol cambia los permisos propios: la UI se pone al dia.
    if (saved.id === sessionUserId) void refreshSession();
  };

  const handleRoleSaved = (saved: Role) => {
    refetchRoles();
    if (saved.id === sessionRoleId) void refreshSession();
  };

  const exportColumns: ExportColumn<User>[] = [
    { header: 'Nombre', accessor: (u) => u.fullName },
    { header: 'Email', accessor: (u) => u.email },
    { header: 'Rol', accessor: (u) => roleName(u.roleId) },
    { header: 'Estado', accessor: (u) => (u.active ? 'Activo' : 'Inactivo') },
  ];

  if (!canView) {
    return (
      <>
        <h3 className="settings-section-title">Usuarios y Roles</h3>
        <p>No tenes permiso para ver usuarios y roles (hace falta settings.ver).</p>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="settings-section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>Directorio de Usuarios</h3>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {usersExportAvailable && <ExportButton fileNamePrefix="usuarios" columns={exportColumns} fetchRows={() => exportUsers()} />}
          {canCreate && (
            <button type="button" className="client-modal-btn client-modal-btn--primary" onClick={openCreate} disabled={roles.length === 0}>
              Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      <div style={{ width: '100%' }}>
        {!empresaId || isLoading ? (
          <LoadingState message="Cargando usuarios..." />
        ) : error ? (
          <ErrorState message="No se pudo cargar el listado de usuarios." onRetry={refetch} />
        ) : (
          <ErrorBoundary fallbackTitle="No se pudo mostrar el listado de usuarios." fallbackMessage="Intenta de nuevo o volve al inicio.">
            <FetchingOverlay isFetching={isFetching}>
              <Table
                data={users}
                keyExtractor={(u) => u.id}
                columns={[
                  { header: 'Nombre', accessor: 'fullName' },
                  { header: 'Email', accessor: 'email' },
                  {
                    header: 'Rol',
                    accessor: (u) => <Badge label={roleName(u.roleId)} variant={roleName(u.roleId) === 'Admin' ? 'warning' : 'accent'} />,
                  },
                  {
                    header: 'Estado',
                    accessor: (u) => <Badge label={u.active ? 'Activo' : 'Inactivo'} variant={u.active ? 'success' : 'danger'} />,
                  },
                  { header: 'Sucursales', accessor: (u) => branchNames(u.branchIds) },
                  {
                    header: 'Acciones',
                    align: 'right',
                    accessor: (u) =>
                      canEdit ? (
                        <button
                          type="button"
                          className="client-modal-btn client-modal-btn--outline"
                          style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }}
                          onClick={() => openEdit(u)}
                          disabled={roles.length === 0}
                        >
                          Editar
                        </button>
                      ) : null,
                  },
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
      {!empresaId || isLoadingRoles ? (
        <LoadingState message="Cargando matriz de permisos..." />
      ) : rolesError ? (
        <ErrorState message="No se pudo cargar la matriz de permisos." onRetry={refetchRoles} />
      ) : (
        <ErrorBoundary fallbackTitle="No se pudo mostrar la matriz de permisos." fallbackMessage="Intenta de nuevo o volve al inicio.">
          <RolePermissionsEditor roles={roles} canEdit={canEdit} onSaved={handleRoleSaved} onConflict={refetchRoles} />
        </ErrorBoundary>
      )}

      {form && (
        <UserFormModal
          key={form.idempotencyKey}
          mode={form.mode}
          user={form.mode === 'edit' ? form.user : undefined}
          roles={roles}
          branches={branches}
          idempotencyKey={form.idempotencyKey}
          onClose={() => setForm(null)}
          onSaved={handleUserSaved}
          onConflict={refetch}
        />
      )}
    </>
  );
};
