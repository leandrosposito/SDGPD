import { ApiError } from '@/shared/api/ApiError';

// ============================================================
// settingsErrors — mensaje para el usuario de un error de Usuarios y Roles
// (BE-1b). Los codigos son los del contrato (ADR-BE-004 › Errores): el
// backend los manda en `code` y httpClient los deja en ApiError.serverCode.
// ============================================================

export function settingsErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.serverCode) {
    case 'version-conflict':
      return 'Alguien modifico este registro mientras lo editabas. Se recargaron los datos: revisalos y volve a guardar.';
    case 'last-admin':
      return 'No se puede: la empresa se quedaria sin ningun usuario activo que pueda editar usuarios y permisos (settings.editar). Dale ese permiso a otro usuario activo primero.';
    case 'email-in-use':
      return 'Ese email ya lo usa otro usuario.';
    case 'role-not-found':
      return 'El rol elegido ya no existe. Recarga la pagina.';
    case 'branch-not-found':
      return 'Alguna de las sucursales elegidas ya no existe. Recarga la pagina.';
    case 'forbidden':
      return 'No tenes permiso para hacer este cambio.';
    case 'validation-error':
      return 'Hay datos invalidos en el formulario.';
    default:
      return err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' ? 'No se pudo conectar con el servidor.' : fallback;
  }
}

/** ¿El error es un conflicto de version (hay que recargar lo que se muestra)? */
export function isVersionConflict(err: unknown): boolean {
  return err instanceof ApiError && err.serverCode === 'version-conflict';
}
