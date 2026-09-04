import { useQuery } from '@tanstack/react-query';
import { cachedQueryKey } from '@/shared/api/queryKeys';
import { useSessionStore } from '@/shared/state/useSessionStore';

// ============================================================
// useCachedQuery — Hermano de usePagedQuery para datos que NO se
// paginan (Tanda 2.5 de escalabilidad, RELEVAMIENTO_CACHE.md):
// catalogos completos (productos, proveedores, clientes), stock por
// sucursal, y gets puntuales por id (historial de OC de un
// proveedor, stock de un producto). Mismos principios que
// usePagedQuery por dentro (TanStack Query, empresaId siempre en la
// key, signal real) — separado en su propio hook en vez de forzarlo
// dentro de usePagedQuery porque no hay pagina/pageSize/sort que
// gestionar: forzar esos campos en la firma de un catalogo completo
// seria un contrato que miente sobre lo que el dato es.
//
// Un solo hook para lista Y get puntual: `keyParams` es la pieza que
// varia entre ellos (undefined para un catalogo completo sin
// parametros, un branchId para stock de sucursal, un supplierId para
// historial de OC) — ver shared/api/queryKeys.ts#cachedQueryKey.
// ============================================================

// staleTime por categoria de dato (RELEVAMIENTO_CACHE.md, seccion "F2"
// y la recomendacion pedida en esa tarea) — constantes nombradas, no
// numeros sueltos en cada call site:
//
// - CATALOG (5 min): productos, proveedores, clientes. Cambian poco
//   (un alta/edicion es un evento raro comparado con cuanto se navega
//   entre pantallas que los necesitan) y son la causa directa del bug
//   reportado (RELEVAMIENTO_CACHE.md, D2/D4) — el objetivo explicito
//   es que volver a Inventario, Compras o el modal de Pedidos no
//   vuelva a pedir el mismo catalogo. Una mutacion real (alta/edicion/
//   baja) no depende de este tiempo: invalida la key explicitamente
//   (ver la tabla de invalidacion por mutacion, DECISIONES_TECNICAS.md),
//   asi que un staleTime largo no oculta un cambio propio, solo evita
//   repetir un fetch cuando nada cambio.
// - OPERATIONAL (30s): stock por sucursal (catalogo unido a stock, y
//   stock puntual de un producto), historial de OC de un proveedor.
//   Mismo criterio que el staleTime de usePagedQuery (Tanda 2,
//   queryClient.ts): otro usuario puede estar moviendo stock o
//   generando ordenes en simultaneo, asi que estos datos se consideran
//   frescos por mucho menos tiempo que un catalogo.
// - DERIVED (2 min): datos agregados/calculados sin mutador propio
//   hoy (dashboard). Ningun evento en el proyecto invalida esto todavia
//   (nada hace "esto cambio, refresca el dashboard") — un staleTime
//   mas largo que OPERATIONAL reduce el costo de volver al Dashboard
//   sin agregar un riesgo nuevo: hoy, sin cache, el dashboard ya podia
//   mostrar un KPI desactualizado hasta el proximo montaje o el
//   boton "Actualizar" manual: cachear 2 minutos no empeora eso.
export const CACHE_STALE_TIME = {
  CATALOG: 5 * 60_000,
  OPERATIONAL: 30_000,
  DERIVED: 2 * 60_000,
} as const;

export interface UseCachedQueryOptions {
  // Permite diferir el fetch (ej. un panel cerrado, o un id que
  // todavia no existe) — mismo criterio que usePagedQuery. Default true.
  enabled?: boolean;
  // Una de las constantes CACHE_STALE_TIME de arriba — deliberadamente
  // sin default silencioso a una categoria "segura": cada call site
  // documenta explicitamente a que categoria de dato pertenece.
  staleTime: number;
}

export interface UseCachedQueryResult<TResult> {
  data: TResult | undefined;
  // true solo hasta que llega la primera respuesta (exito o error) de
  // esta consulta — mismo significado que en usePagedQuery.
  isLoading: boolean;
  // true mientras hay un pedido en vuelo. Igual que en usePagedQuery,
  // `!queryEnabled || query.isFetching` para que quedar deshabilitado
  // (ej. panel cerrado) se vea como "todavia no hay nada", no como
  // "ya se resolvio y no hay nada".
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCachedQuery<TResult>(
  // Identifica el dato dentro del cache (ej. 'products', 'suppliers-list',
  // 'stock-by-branch', 'purchase-orders-by-supplier') — es el prefijo
  // de invalidacion quirurgica (ver queryKeys.ts#cachedQueryKey), asi
  // que dos consumidores que piden EL MISMO dato deben pasar el MISMO
  // queryName a proposito (eso es lo que produce el dedupe entre
  // modulos — ver DECISIONES_TECNICAS.md).
  queryName: string,
  // Lo que distingue una instancia de este dato de otra dentro del
  // mismo queryName (un branchId, un supplierId, o undefined si el
  // dato no tiene parametros — ej. un catalogo completo). Debe ser un
  // valor estable entre renders si es un objeto (mismo criterio que
  // `filters` en usePagedQuery: memoizalo con useMemo si no es un
  // primitivo), aunque en la practica casi siempre es un string o
  // undefined para este hook.
  keyParams: unknown,
  // La funcion que efectivamente pide el dato. Recibe el signal real
  // de useQuery (reemplaza cualquier AbortController manual, mismo
  // criterio que usePagedQuery) — quien la escribe ya debe tener
  // resueltos sus propios parametros por clausura (ej.
  // `(signal) => getStockedProductsForBranch(activeBranchId, signal)`).
  fetchFn: (signal: AbortSignal) => Promise<TResult>,
  options: UseCachedQueryOptions
): UseCachedQueryResult<TResult> {
  const { enabled = true, staleTime } = options;

  const empresaId = useSessionStore((s) => s.session?.company.id);
  const queryEnabled = enabled && Boolean(empresaId);

  const query = useQuery({
    queryKey: cachedQueryKey({ queryName, empresaId: empresaId ?? '', keyParams }),
    queryFn: ({ signal }) => fetchFn(signal),
    enabled: queryEnabled,
    staleTime,
  });

  const isLoading = query.isPending;
  const isFetching = !queryEnabled || query.isFetching;
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : 'No se pudo cargar la informacion.'
    : null;

  function refetch() {
    void query.refetch();
  }

  return { data: query.data, isLoading, isFetching, error, refetch };
}
