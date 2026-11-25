-- RLS de los maestros de BE-2 (ADR-BE-002 §Decisión 2): proveedores, vehículos, choferes y motivos.
-- Escrita a mano, sin nombre de schema ni de rol (ver 0001). Una política por tabla: la fila es
-- visible y escribible solo si su empresa_id es la del tenant fijado en la transacción (app.empresa_id).

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
