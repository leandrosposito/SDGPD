import { useState, type FC } from 'react';
import './TabAdjustments.css';

// ============================================================
// TabAdjustments — Panel para registrar correcciones manuales
// ============================================================

export const TabAdjustments: FC = () => {
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [motive, setMotive] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Aca iria la logica para buscar el producto por codigo de barras
      console.log('Buscando producto:', productSearch);
    }
  };

  return (
    <div className="tab-adjustments">
      <div className="tab-adjustments__panel">
        <h3 className="tab-adjustments__title">Registrar Ajuste Manual</h3>
        <p className="tab-adjustments__subtitle">
          Utiliza este panel para corregir discrepancias de inventario sin generar una orden de compra o venta.
        </p>

        <form className="tab-adjustments__form" onSubmit={(e) => e.preventDefault()}>
          <div className="tab-adjustments__form-group">
            <label htmlFor="adj-product">Producto (Escanear Codigo o Buscar)</label>
            <input
              id="adj-product"
              type="text"
              placeholder="Ej: 7791234567890 o 'Cerveza'"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="tab-adjustments__input"
              autoComplete="off"
            />
          </div>

          <div className="tab-adjustments__form-row">
            <div className="tab-adjustments__form-group">
              <label htmlFor="adj-quantity">Cantidad a Ajustar</label>
              <input
                id="adj-quantity"
                type="number"
                placeholder="Ej: -5 o 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="tab-adjustments__input"
              />
            </div>

            <div className="tab-adjustments__form-group">
              <label htmlFor="adj-motive">Motivo</label>
              <select
                id="adj-motive"
                value={motive}
                onChange={(e) => setMotive(e.target.value)}
                className="tab-adjustments__input"
              >
                <option value="">Seleccione un motivo...</option>
                <option value="error_carga">Error de carga</option>
                <option value="producto_roto">Producto roto</option>
                <option value="producto_vencido">Producto vencido</option>
                <option value="perdida">Perdida</option>
                <option value="robo">Robo</option>
                <option value="inventario_fisico">Inventario fisico</option>
              </select>
            </div>
          </div>

          <div className="tab-adjustments__form-row">
            <div className="tab-adjustments__form-group">
              <label htmlFor="adj-lote">N° Lote (Si aplica)</label>
              <input
                id="adj-lote"
                type="text"
                placeholder="Ej: L202405A"
                className="tab-adjustments__input"
              />
            </div>

            <div className="tab-adjustments__form-group">
              <label htmlFor="adj-vencimiento">Fecha de Vencimiento</label>
              <input
                id="adj-vencimiento"
                type="date"
                className="tab-adjustments__input"
              />
            </div>
          </div>

          <div className="tab-adjustments__form-group">
            <label htmlFor="adj-notes">Observaciones (Opcional)</label>
            <textarea
              id="adj-notes"
              rows={3}
              placeholder="Detalles adicionales del ajuste..."
              className="tab-adjustments__input"
            />
          </div>

          <div className="tab-adjustments__actions">
            <button type="submit" className="tab-adjustments__btn-submit">
              Confirmar Ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
