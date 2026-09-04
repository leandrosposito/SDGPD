// ============================================================
// shared/api/types.ts — Tipos base de la capa api/.
//
// La respuesta paginada NO se redefine aca: `PageQuery`/`PageResult`
// (shared/types/pagination.types.ts) ya es el contrato en uso por los
// 6 listados migrados a usePagedQuery — repetirlo aca violaria la
// norma de no-duplicacion del proyecto (DECISIONES_TECNICAS.md).
// Cada `<modulo>.service.ts` sigue devolviendo PageResult<TDomain, TAggregates>
// desde su getXPage — la capa api/ solo agrega DTO/mapper *antes* de
// ese resultado, no un contrato de paginacion nuevo.
// ============================================================

// Contexto de tenant: toda funcion de un service de modulo lo recibe
// como parametro explicito desde ahora (igual criterio ya establecido
// para branchId — ver D4/D5, DECISIONES_TECNICAS.md: "branchId viaja
// como parametro explicito a los servicios; el servicio no lee
// useSessionStore internamente"). Hoy `empresaId` tiene un valor fijo
// (no hay seleccion de multiples empresas, hallazgo #14 de la
// auditoria queda fuera de alcance) pero el contrato ya lo exige, para
// que agregar el filtrado real de tenant el dia que exista backend sea
// un cambio de "que valor se pasa", no de firma de cada funcion.
export interface TenantContext {
  empresaId: string;
}

// Opciones que cualquier llamada a httpClient.request puede recibir,
// mas alla de las propias del endpoint (metodo/path/body/params).
export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}
