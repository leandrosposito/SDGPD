import { type FC } from 'react';

interface ClientSettingsTabProps {
  categoria: string;
  setCategoria: (val: string) => void;
  notas: string;
  setNotas: (val: string) => void;
  isActive: boolean;
  setIsActive: (val: boolean) => void;
}

export const ClientSettingsTab: FC<ClientSettingsTabProps> = ({
  categoria, setCategoria,
  notas, setNotas,
  isActive, setIsActive
}) => {
  return (
    <div className="client-form-col">
      <div className="client-form-grid">
        <div className="client-form-group">
          <label className="client-form-label">Categoria del Negocio</label>
          <select 
            className="client-form-select"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="Kiosco">Kiosco</option>
            <option value="Almacen">Almacen</option>
            <option value="Supermercado">Supermercado</option>
            <option value="Mayorista">Mayorista</option>
          </select>
        </div>

        <div className="client-form-group flex items-center justify-end">
          <label className="client-toggle">
            <span className="client-toggle-label">{isActive ? 'Cliente Activo' : 'Cliente Inactivo'}</span>
            <input 
              type="checkbox" 
              className="client-toggle-input" 
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <div className="client-toggle-switch"></div>
          </label>
        </div>

        <div className="client-form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="client-form-label">Notas / Observaciones Internas</label>
          <textarea 
            className="client-form-input client-form-input--textarea"
            placeholder="Informacion confidencial o detalles de la relacion comercial..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
