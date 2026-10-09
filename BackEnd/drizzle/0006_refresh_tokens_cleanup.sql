-- Limpieza de refresh tokens vencidos (BE-1b), en el mismo scheduler que la de idempotencia.
-- Mismo mecanismo que expired_cleanup de idempotency_keys (0003): un DELETE sin WHERE y sin RETURNING
-- pasa solo por las políticas de DELETE, así que sin tenant borra los vencidos de todas las empresas y
-- no puede leer ni devolver ninguna fila. Con tenant y con WHERE, tenant_isolation sigue mandando.
-- Un token vencido ya no sirve para nada: ni para refrescar ni para detectar un reuso (vencido = inválido).
CREATE POLICY "expired_cleanup" ON "refresh_tokens" AS PERMISSIVE FOR DELETE
  USING ("expires_at" <= now());
