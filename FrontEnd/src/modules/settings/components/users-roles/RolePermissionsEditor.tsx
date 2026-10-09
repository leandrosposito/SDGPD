import { useState, type FC } from 'react';
import { toast } from 'sonner';
import { ACTIONS, MODULES, type Action, type Module, type Permission, type Role } from '@sdgpd/contracts';
import { updateRolePermissions } from '@/modules/settings/api/users-roles/users-roles.service';
import { isVersionConflict, settingsErrorMessage } from './settingsErrors';
import './UsersRoles.css';

// ============================================================
// RolePermissionsEditor — matriz modulo × accion de un rol (BE-1b,
// ADR-BE-003 sub-decision 6): 10 modulos × 7 acciones. Se edita un
// borrador local y se guarda entero (PUT /api/roles/:id/permissions) con la
// version que se leyo: 409 si otro la cambio, 422 last-admin si dejaria a
// la empresa sin quien edite usuarios y permisos.
//
// Sin efectos que sincronicen estado (regla 3.9): lo que se muestra es el
// borrador si existe para ESE rol y ESA version, o la matriz del servidor.
// La clave de idempotencia se genera al empezar a editar (al formar la
// intencion, ADR-BE-005).
// ============================================================

const MODULE_LABELS: Record<Module, string> = {
  analytics: 'Analitica',
  cash: 'Caja',
  clients: 'Clientes',
  compras: 'Compras',
  dashboard: 'Dashboard',
  inventory: 'Inventario',
  logistics: 'Logistica',
  orders: 'Pedidos',
  settings: 'Configuracion',
  suppliers: 'Proveedores',
};

const keyOf = (module: Module, action: Action) => `${module}.${action}`;

interface Draft {
  roleId: string;
  baseVersion: number;
  keys: ReadonlySet<string>;
  idempotencyKey: string;
}

export interface RolePermissionsEditorProps {
  roles: Role[];
  canEdit: boolean;
  onSaved: (role: Role) => void;
  // 409: la matriz cambio en el servidor; el padre recarga los roles.
  onConflict: () => void;
}

export const RolePermissionsEditor: FC<RolePermissionsEditorProps> = ({ roles, canEdit, onSaved, onConflict }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const role = roles.find((r) => r.id === selectedId) ?? roles[0];
  if (!role) return <p className="role-matrix__hint">No hay roles.</p>;

  const serverKeys = new Set(role.permissions.map((p) => keyOf(p.module, p.action)));
  const activeDraft = draft && draft.roleId === role.id && draft.baseVersion === role.version ? draft : null;
  const shown = activeDraft?.keys ?? serverKeys;
  const dirty = activeDraft !== null && (activeDraft.keys.size !== serverKeys.size || [...activeDraft.keys].some((k) => !serverKeys.has(k)));

  function toggle(module: Module, action: Action) {
    if (!canEdit || !role) return;
    const next = new Set(shown);
    const k = keyOf(module, action);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setDraft({
      roleId: role.id,
      baseVersion: role.version,
      keys: next,
      idempotencyKey: activeDraft?.idempotencyKey ?? crypto.randomUUID(),
    });
  }

  async function save() {
    if (!activeDraft || !role) return;
    const permissions: Permission[] = MODULES.flatMap((module) =>
      ACTIONS.filter((action) => activeDraft.keys.has(keyOf(module, action))).map((action) => ({ module, action }))
    );
    setIsSaving(true);
    try {
      const saved = await updateRolePermissions(role.id, { permissions, version: activeDraft.baseVersion }, activeDraft.idempotencyKey);
      setDraft(null);
      toast.success(`Permisos de ${role.name} guardados.`);
      onSaved(saved);
    } catch (err) {
      toast.error(settingsErrorMessage(err, 'No se pudo guardar la matriz.'));
      if (isVersionConflict(err)) {
        setDraft(null);
        onConflict();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <div className="role-matrix__roles" role="tablist" aria-label="Roles">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === role.id}
            className={`client-modal-btn client-modal-btn--outline${r.id === role.id ? ' role-matrix__role-btn--active' : ''}`}
            onClick={() => setSelectedId(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table className="role-matrix__table" aria-label={`Permisos del rol ${role.name}`}>
          <thead>
            <tr>
              <th>Modulo</th>
              {ACTIONS.map((a) => (
                <th key={a}>{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m}>
                <td>{MODULE_LABELS[m]}</td>
                {ACTIONS.map((a) => (
                  <td key={a}>
                    <input
                      type="checkbox"
                      checked={shown.has(keyOf(m, a))}
                      disabled={!canEdit || isSaving}
                      onChange={() => toggle(m, a)}
                      aria-label={`${MODULE_LABELS[m]}: ${a}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="role-matrix__footer">
        <span className="role-matrix__hint">
          {canEdit ? (dirty ? 'Hay cambios sin guardar.' : 'Version ' + role.version + '.') : 'Solo lectura: no tenes settings.editar.'}
        </span>
        {canEdit && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="client-modal-btn client-modal-btn--outline" disabled={!dirty || isSaving} onClick={() => setDraft(null)}>
              Descartar
            </button>
            <button type="button" className="client-modal-btn client-modal-btn--primary" disabled={!dirty || isSaving} onClick={() => void save()}>
              {isSaving ? 'Guardando...' : 'Guardar matriz'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
