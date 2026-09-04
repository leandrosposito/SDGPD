// ============================================================
// logError — Punto único de registro de errores del frontend.
// Hoy hace console.error con formato estructurado; es el punto de
// enganche para telemetría real (Sentry, un endpoint propio, etc.)
// el día que exista un backend — ese día cambia la implementación
// de esta función, no cada call-site que hoy llama a logError.
// ============================================================

export function logError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error('[SDGPD]', {
    message,
    stack,
    context,
    timestamp: new Date().toISOString(),
  });
}
