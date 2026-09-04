import { QueryClient } from '@tanstack/react-query';
import { registerResettableStore } from '@/shared/state/resettableStores';

// ============================================================
// queryClient — instancia global de TanStack Query (Tanda 2 de
// escalabilidad, hallazgo #8 AUDITORIA_ESCALABILIDAD.md): agrega
// cache, dedupe entre componentes e invalidacion cruzada por encima
// de httpClient. NO reemplaza a httpClient — httpClient sigue siendo
// el unico punto que hace la peticion en si (timeout, reintentos,
// VITE_API_DEBUG); TanStack Query solo decide CUANDO llamarlo y que
// hacer con el resultado mientras vive en memoria. Ver
// DECISIONES_TECNICAS.md para el razonamiento completo.
//
// Defaults, uno por uno (todos explicitos a proposito, ninguno
// implicito aunque coincida con el default de la libreria):
//
// - staleTime: 30_000ms. Tiempo que un resultado se considera
//   "fresco": mientras dura, volver a montar el mismo listado (ej.
//   navegar a otro modulo y volver) no dispara un fetch nuevo, sirve
//   el cache tal cual. 30s balancea no repetir pedidos al navegar
//   entre pantallas del mismo listado contra no mostrar datos viejos
//   por mucho tiempo en un ERP donde otro usuario puede estar
//   mutando los mismos datos en simultaneo.
//
// - gcTime: 5 minutos. Cuanto tiempo un query SIN observadores
//   activos (ningun componente montado que lo use) se mantiene en
//   memoria antes de descartarse. Mayor que staleTime a proposito:
//   volver a una pantalla ya visitada bastante despues todavia
//   muestra el cache viejo al instante (revalidandose en segundo
//   plano si ya supero staleTime) en vez de una pantalla en blanco.
//
// - refetchOnWindowFocus: false. Default de la libreria es true; se
//   desactiva porque en un ERP de uso interno (una pestaña, turnos
//   largos, alt-tab constante a otras apps de trabajo) refetchear
//   cada vez que la ventana recupera el foco es ruido, no valor — y
//   el proyecto ya tiene su propio mecanismo explicito de
//   invalidacion (cambio de sucursal/empresa, mutaciones via
//   refetch()) en vez de depender de cuando el usuario mira la
//   pestaña.
//
// - retry: false. Los reintentos de red YA los maneja httpClient (2,
//   con backoff exponencial, solo errores de red/timeout/5xx — ver
//   httpClient.ts). Dejar tambien el retry de TanStack Query prendido
//   duplicaria la politica en dos capas (hasta 3 reintentos propios
//   de TQ por ENCIMA de los 2 que ya hizo httpClient sobre el mismo
//   error) sin que ninguna de las dos golpee mas rapido la causa
//   real. Una sola politica de reintentos, en una sola capa.
// ============================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// ------------------------------------------------------------
// Invalidacion cruzada al cambiar de sucursal o de empresa (decision
// ya tomada, ver CLAUDE.md de la tarea): se engancha al mismo
// registro de resettableStores que ya usan los stores de zustand de
// modulo (shared/state/resettableStores.ts, ver
// useReplenishmentStore.ts como referencia) en vez de inventar un
// mecanismo aparte. resetAllStores() ya se llama desde
// useSessionStore#setActiveBranch — este registro hace que, ademas
// de resetear esos stores, tambien invalide TODO el cache de
// TanStack Query.
//
// invalidateQueries() sin filtro (no un removeQueries ni una key
// puntual) a proposito: marca todo como stale y dispara un refetch
// de los queries con observadores activos ahora mismo — mismo
// criterio "amplio" que resetAllStores ya aplica a los stores de
// modulo, y necesario ademas porque un listado de empresa (ej.
// suppliers, sin branchId en su filtro) no cambia de query key al
// cambiar de sucursal — sin esta invalidacion explicita, seguiria
// sirviendo su cache tal cual, que es lo correcto para sucursal pero
// no lo seria el dia que cambie la empresa.
// ------------------------------------------------------------
registerResettableStore(() => {
  void queryClient.invalidateQueries();
});
