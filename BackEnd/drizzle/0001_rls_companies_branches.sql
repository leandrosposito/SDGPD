-- RLS de companies y branches (ADR-BE-002 §Decisión 2). Escrita a mano: drizzle-kit no genera FORCE.
-- Sin nombre de schema ni de rol: el schema destino lo fija scripts/db/migrate.ts con search_path,
-- y los privilegios de cada rol de aplicación los fijan los default privileges de scripts/db/setup.ts.
--
-- El tenant es app.empresa_id, fijado por transacción con set_config(..., true) (Database.withTenant).
-- Sin tenant, current_setting(..., true) devuelve NULL (nunca fijado en la sesión) o '' (fijado y
-- revertido al cerrar una transacción anterior de la misma conexión): nullif(..., '') unifica los
-- dos casos en NULL, la comparación nunca es verdadera y la consulta no ve ninguna fila (fail-closed).

ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "companies" AS PERMISSIVE FOR ALL
  USING ("id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "branches" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
