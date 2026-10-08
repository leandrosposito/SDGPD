-- RLS de idempotency_keys, audit_log y document_counters (ADR-BE-002 §Decisión 2, BE-0b).
-- Escrita a mano: drizzle-kit no genera FORCE. Sin nombre de schema ni de rol (ver 0001).
-- Misma expresión de tenant que 0001: nullif(current_setting('app.empresa_id', true), '')::uuid.

-- idempotency_keys: aislamiento por empresa, más una política que deja borrar las VENCIDAS sin tenant,
-- para la limpieza periódica (ADR-BE-005, sub-decisión 8). Postgres aplica las políticas de SELECT a
-- todo DELETE que lea columnas (WHERE o RETURNING); un DELETE sin WHERE y sin RETURNING, en cambio,
-- solo pasa por las de DELETE. Así, sin tenant, `DELETE FROM idempotency_keys` borra solo las
-- vencidas de todas las empresas, y no puede leer ni devolver ninguna fila. Con tenant y con WHERE,
-- solo alcanza las de la empresa. (Probado en test/db/idempotency.test.ts.)
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "idempotency_keys" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "expired_cleanup" ON "idempotency_keys" AS PERMISSIVE FOR DELETE
  USING ("expires_at" <= now());
--> statement-breakpoint

-- audit_log: append-only. Solo hay políticas de SELECT e INSERT, y los roles de aplicación no tienen
-- UPDATE ni DELETE (los revoca scripts/db, APPEND_ONLY_TABLES): un UPDATE o un DELETE falla por permisos.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_read" ON "audit_log" AS PERMISSIVE FOR SELECT
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_append" ON "audit_log" AS PERMISSIVE FOR INSERT
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint

-- document_counters: aislamiento por empresa.
ALTER TABLE "document_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document_counters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "document_counters" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
