import type { Order } from '@/shared/types/order.types';
import type { ClientAccount } from '@/shared/types/client.types';

// ============================================================
// resolveOrderClient — funcion pura que resuelve la relacion tipada
// Order.clientId -> ClientAccount (Tanda 5, ADR-006/AUDIT_4_IDS_RELACIONES.md
// hallazgo ALTO #1). Separada en su propio archivo, sin ningun import
// en tiempo de ejecucion (los dos `import type` de arriba se eliminan
// por completo al compilar/type-stripping — Order/ClientAccount solo
// se usan para tipar, nunca en runtime), para poder ejercitarla desde
// el smoke script de Tanda 5 sin necesitar el resolver de alias `@/`
// que Node no entiende fuera de Vite/tsc.
// ============================================================

export function resolveOrderClient(
  order: Pick<Order, 'clientId'>,
  clients: readonly ClientAccount[]
): ClientAccount | undefined {
  return clients.find((client) => client.id === order.clientId);
}
