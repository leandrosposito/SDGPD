// ============================================================
// patente — Normalizacion pura de patente de vehiculo (Tanda 11).
// Extraido de vehicles.service.ts para poder ejercitarse con un smoke
// script puro (node, sin import.meta.env) — mismo criterio que
// shared/utils/tripCapacity.ts/orderNumber.ts.
//
// Mayusculas y sin espacios — formatos reales varian (AB123CD
// Mercosur, ABC123 viejo, ambos alfanumericos, ninguno usa guiones).
// Se usa tanto para lo GUARDADO como para lo COMPARADO (a diferencia
// del SKU de ProductFormModal, que preserva la escritura del usuario y
// solo compara case-insensitive) — una patente es un identificador
// canonico, guardar "ab123cd" y "AB123CD" como si fueran dos vehiculos
// distintos seria el bug, no una eleccion de estilo.
// ============================================================

export function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}
