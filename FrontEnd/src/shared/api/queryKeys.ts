// ============================================================
// queryKeys — fabrica tipada de query keys para usePagedQuery
// (Tanda 2 de escalabilidad, hallazgo #8 AUDITORIA_ESCALABILIDAD.md).
//
// empresaId es un parametro obligatorio (no opcional, sin default) a
// proposito: es la barrera de aislamiento multi-tenant del cache de
// TanStack Query — sin empresaId en la key, dos empresas distintas
// podrian compartir el cache de un mismo listado (mismo modulo,
// mismos filtros) el dia que una sesion pueda ver mas de una empresa.
// Hoy hay una sola empresa (igual que en httpClient/services, ver
// DECISIONES_TECNICAS.md), pero el aislamiento se paga ahora, no
// cuando haga falta. TypeScript no compila un llamado a
// pagedQueryKey() que omita empresaId: no hay overload ni valor por
// defecto que lo permita.
//
// `queryName` identifica el listado (modulo + consulta) dentro del
// cache global. No es un parametro nuevo que cada consumidor deba
// pasar: usePagedQuery lo deriva de `fetchPage.name` (el nombre de la
// funcion de servicio, ej. "fetchSuppliersPage") — ya es requisito
// que `fetchPage` sea una referencia estable exportada de un service,
// asi que su `.name` ya identifica univocamente el listado sin sumar
// un parametro a la firma publica del hook (que no cambia, ver
// DECISIONES_TECNICAS.md).
// ============================================================

export interface PagedQueryKeyParams {
  queryName: string;
  empresaId: string;
  filters: unknown;
  sort: unknown;
  page: number;
  pageSize: number;
}

export function pagedQueryKey(params: PagedQueryKeyParams) {
  const { queryName, empresaId, filters, sort, page, pageSize } = params;
  // Jerarquica a proposito (['paged', queryName, empresaId, ...resto]):
  // permite en el futuro invalidar/consultar por prefijo (ej. todo lo
  // de una empresa, o todo un listado) sin tener que rearmar la key
  // completa — no se usa asi todavia (la invalidacion de esta tanda es
  // total, ver queryClient.ts), pero la estructura no cuesta nada hoy.
  return ['paged', queryName, empresaId, filters, sort, page, pageSize] as const;
}
