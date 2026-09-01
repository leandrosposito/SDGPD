// ============================================================
// resettableStores — Registro central de stores de zustand que
// deben volver a su estado inicial cuando cambia la sucursal activa.
//
// Por que un registro y no que useSessionStore importe cada store
// de modulo directamente: shared/ no debe depender de modules/ (la
// direccion de dependencia del proyecto es siempre modules -> shared,
// nunca al reves — ver docs/ESTRUCTURA_Y_ARQUITECTURA.md). Con el
// registro, cada store de modulo se auto-registra al importarse
// (una linea junto a su `create(...)`), y useSessionStore solo
// conoce esta funcion generica, no los stores concretos.
//
// Convencion para un store nuevo: llamar a registerResettableStore
// una sola vez, en el mismo archivo del store, inmediatamente
// despues de `export const use<Nombre>Store = create(...)`. Ver
// modules/logistics/state/useDeliveriesStore.ts o
// modules/inventory/state/useReplenishmentStore.ts como referencia.
// ============================================================

type ResetFn = () => void;

const resettableStores: ResetFn[] = [];

export function registerResettableStore(reset: ResetFn): void {
  resettableStores.push(reset);
}

export function resetAllStores(): void {
  resettableStores.forEach((reset) => reset());
}
