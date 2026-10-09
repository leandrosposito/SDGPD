// ============================================================
// serviceModes — que services van por HTTP contra el backend (BE-1b).
//
// UN solo lugar: la variable VITE_HTTP_SERVICES (lista separada por
// comas), que lee httpClient.ts. Ejemplo para trabajar contra el backend
// con el seed: VITE_HTTP_SERVICES=auth,session,users,roles,branches en
// FrontEnd/.env.local. Sin la variable (o vacia), TODO sigue en mock como
// antes de BE-1b: sesion mock y sin pantalla de login, para poder
// trabajar sin backend.
//
// Solo se pueden declarar los services que el backend ya sirve
// (CONNECTABLE_SERVICES). Un nombre desconocido es un error de
// configuracion, no se ignora en silencio: la app no arranca con el
// mensaje. Reglas de coherencia:
// - 'auth' y 'session' van juntos (el login devuelve la sesion y la
//   sesion necesita el token del login);
// - 'users', 'roles' y 'branches' exigen 'auth' (necesitan el token).
// Este archivo no lee import.meta.env: asi lo puede ejercitar `node`
// (scripts/smoke/be-1b.smoke.mjs).
// ============================================================

export const CONNECTABLE_SERVICES = ['auth', 'session', 'users', 'roles', 'branches'] as const;
export type ServiceName = (typeof CONNECTABLE_SERVICES)[number];

export class ServiceModesError extends Error {
  constructor(message: string) {
    super(`VITE_HTTP_SERVICES: ${message}`);
    this.name = 'ServiceModesError';
  }
}

function isServiceName(value: string): value is ServiceName {
  return CONNECTABLE_SERVICES.some((s) => s === value);
}

export function parseHttpServices(raw: string | undefined): ReadonlySet<ServiceName> {
  const names = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  const services = new Set<ServiceName>();
  for (const name of names) {
    if (!isServiceName(name)) {
      throw new ServiceModesError(
        `"${name}" no es un service conectado al backend (validos: ${CONNECTABLE_SERVICES.join(', ')})`
      );
    }
    services.add(name);
  }
  if (services.has('auth') !== services.has('session')) {
    throw new ServiceModesError('"auth" y "session" se declaran juntos');
  }
  for (const name of ['users', 'roles', 'branches'] as const) {
    if (services.has(name) && !services.has('auth')) {
      throw new ServiceModesError(`"${name}" necesita "auth" (va con el token de la sesion)`);
    }
  }
  return services;
}
