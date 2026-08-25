import { useState, type FC } from 'react';
import { SETTINGS_MOCK_PERMISSIONS, SETTINGS_MOCK_USERS } from '../../../../data/mock/settings.data';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import '../../SettingsPage.css';

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

export const TabUsersRoles: FC = () => {
  const [permissions, setPermissions] = useState(SETTINGS_MOCK_PERMISSIONS);

  const togglePermission = (roleIndex: number, module: keyof typeof permissions[0]['modules']) => {
    const newPerms = [...permissions];
    newPerms[roleIndex].modules[module] = !newPerms[roleIndex].modules[module];
    setPermissions(newPerms);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="settings-section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>Directorio de Usuarios</h3>
        <button className="client-modal-btn client-modal-btn--primary">Nuevo Usuario</button>
      </div>
      
      <div style={{ width: '100%' }}>
        <Table
          data={SETTINGS_MOCK_USERS}
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
      </div>

      <div className="divider"></div>

      <h3 className="settings-section-title">Matriz de Permisos por Rol</h3>
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
            {permissions.map((p, idx) => (
              <tr key={p.role}>
                <td>{p.role}</td>
                {Object.entries(p.modules).map(([modName, hasAccess]) => (
                  <td key={modName}>
                    <div 
                      className={`svg-checkbox ${hasAccess ? 'checked' : ''}`}
                      onClick={() => togglePermission(idx, modName as keyof typeof p.modules)}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <button className="client-modal-btn client-modal-btn--primary">Guardar Matriz</button>
      </div>
    </>
  );
};
