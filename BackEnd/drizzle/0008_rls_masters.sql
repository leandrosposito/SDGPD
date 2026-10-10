-- RLS de los maestros de BE-2: proveedores, vehículos, choferes y motivos (ADR-BE-002 §Decisión 2).
-- Escrita a mano. Sin nombre de schema ni de rol (ver 0001). Mismo patrón que 0005: ENABLE + FORCE y
-- la política tenant_isolation con nullif (ADR-BE-002, sub-decisión 10). Sin políticas extra: estas
-- tablas solo se leen y se escriben con tenant.

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "suppliers" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "vehicles" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "drivers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "drivers" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "motivos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "motivos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "motivos" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
