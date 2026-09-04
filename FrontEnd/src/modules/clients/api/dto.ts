import type { ClientAccount, ClientTransaction } from '@/shared/types/client.types';

// ============================================================
// dto.ts (clients) — Forma que tendría la respuesta de un backend
// real para el Directorio de Clientes (Tanda 3d de escalabilidad).
// Deliberadamente distinta del dominio: snake_case y campos agrupados
// (`cliente`, `cuenta`), mismo criterio que el resto de la capa api/.
//
// Cubre SOLO lo que el Directorio lee/escribe (fetchClients/
// createClient/updateClient) — NO a getClientAccountsPage/
// getOverdueClientsPage (Cuentas Corrientes/Clientes Morosos), que
// siguen operando directo sobre el dominio `ClientAccount`, sin DTO,
// porque esta tanda tiene prohibido tocar esa lógica (FIFO/aging).
//
// `transacciones` se pasa TAL CUAL en forma de dominio
// (`ClientTransaction[]`), sin traducir a un DTO anidado propio: el
// Directorio nunca lee ni escribe este campo (alta/edición de cliente
// no toca transacciones — un cliente nuevo arranca con `[]`), y la
// única lógica que interpreta su forma interna es la de aging/FIFO,
// fuera de alcance de esta tanda. Traducirlo sería ampliar el alcance
// a la lógica de facturas/pagos sin necesidad real.
// ============================================================

export interface ClientAccountDTO {
  id: string;
  cliente: {
    razon_social: string;
    cuit: string;
    direccion: string;
    telefono: string;
    zona: string;
    vendedor: string;
  };
  cuenta: {
    limite_credito: number;
    total_debito: number;
    total_credito: number;
    saldo_actual: number;
    dias_vencido: number;
    estado: ClientAccount['status'];
  };
  transacciones: ClientTransaction[];
}

export interface ClientsPageDTO {
  data: ClientAccountDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}

// Payload de alta/edición — solo los campos que el formulario pide
// (mismo criterio que `CreateSupplierDTO`/`CreateOrderDTO`).
export interface ClientFormPayloadDTO {
  razon_social: string;
  cuit: string;
  direccion: string;
  telefono: string;
  zona: string;
  vendedor: string;
  limite_credito: number;
}
