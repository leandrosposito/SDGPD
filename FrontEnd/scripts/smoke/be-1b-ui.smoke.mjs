// ============================================================
// Smoke script — BE-1b, Parte 3. Logica pura de permisos y errores de la UI:
// - hasPermission (shared/auth/permissions.ts), la regla detras de usePermission;
// - settingsErrorMessage / isVersionConflict
//   (modules/settings/components/users-roles/settingsErrors.ts): los codigos
//   409 version-conflict y 422 last-admin del contrato llegan a un mensaje claro;
// - el usuario mock es Admin con la matriz completa (10 × 7), asi que en modo
//   mock todos los botones se siguen viendo como antes.
//
// Correr con: node scripts/smoke/be-1b-ui.smoke.mjs (desde FrontEnd/).
// ============================================================

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const srcBase = new URL('../../src/', import.meta.url).href;
const loaderSource = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      let mapped = ${JSON.stringify(srcBase)} + specifier.slice(2);
      if (!/\\.(ts|tsx|js|jsx|mjs|json|css)$/i.test(mapped)) mapped += '.ts';
      return nextResolve(mapped, context);
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, pathToFileURL('./'));

const { hasPermission } = await import('../../src/shared/auth/permissions.ts');
const { settingsErrorMessage, isVersionConflict } = await import('../../src/modules/settings/components/users-roles/settingsErrors.ts');
const { ApiError } = await import('../../src/shared/api/ApiError.ts');
const { SESSION_MOCK_DATA } = await import('../../src/data/mock/session.mock.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const limited = [{ module: 'inventory', action: 'ver' }];
check('con inventory.ver, ver si', hasPermission(limited, 'inventory', 'ver'));
check('con inventory.ver, crear no (el boton Nuevo Producto se oculta)', !hasPermission(limited, 'inventory', 'crear'));
check('mismo accion en otro modulo no cuenta', !hasPermission(limited, 'orders', 'ver'));
check('sin sesion (permisos undefined), nada', !hasPermission(undefined, 'inventory', 'ver'));
check('lista vacia, nada', !hasPermission([], 'settings', 'editar'));

check(`el usuario mock tiene la matriz completa (${SESSION_MOCK_DATA.permissions.length} = 70)`, SESSION_MOCK_DATA.permissions.length === 70);
check('el usuario mock puede settings.editar e inventory.crear', hasPermission(SESSION_MOCK_DATA.permissions, 'settings', 'editar') && hasPermission(SESSION_MOCK_DATA.permissions, 'inventory', 'crear'));
check('el usuario mock es Admin', SESSION_MOCK_DATA.role.name === 'Admin');

const conflict = new ApiError(409, 'CLIENT_ERROR', 'x', { serverCode: 'version-conflict', details: { currentVersion: 3 } });
const lastAdmin = new ApiError(422, 'CLIENT_ERROR', 'x', { serverCode: 'last-admin' });
const network = new ApiError(0, 'NETWORK_ERROR', 'x');
check('409 version-conflict: mensaje de recarga', settingsErrorMessage(conflict, 'fb').includes('modifico este registro'));
check('409 version-conflict se reconoce como conflicto', isVersionConflict(conflict) && !isVersionConflict(lastAdmin));
check('422 last-admin: explica que la empresa se quedaria sin quien edite', settingsErrorMessage(lastAdmin, 'fb').includes('settings.editar'));
check('sin red: mensaje de conexion', settingsErrorMessage(network, 'fb') === 'No se pudo conectar con el servidor.');
check('un error que no es ApiError: el mensaje por defecto', settingsErrorMessage(new Error('boom'), 'fb') === 'fb');

console.log(failures === 0 ? '\ntodos los chequeos pasaron' : `\n${failures} chequeo(s) fallaron`);
process.exitCode = failures === 0 ? 0 : 1;
