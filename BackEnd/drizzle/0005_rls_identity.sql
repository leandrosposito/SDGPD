-- RLS de las tablas de identidad y las dos funciones SECURITY DEFINER del login y del refresh
-- (ADR-BE-002 §Decisión 2 y sub-decisión 2; ADR-BE-003, BE-1a). Escrita a mano. Sin nombre de schema
-- ni de rol (ver 0001): scripts/db (hardenDefinerFunctions) fija después, en la misma transacción del
-- runner, el search_path de cada función (<schema>, pg_temp) y su EXECUTE (solo el rol de aplicación
-- de ese schema; PUBLIC nunca).
--
-- Login y refresh ocurren antes de conocer el tenant. Lo resuelven SOLO estas funciones: corren como
-- su dueño (sdgpd_migrator), que también está sujeto a RLS (FORCE). Por eso users y refresh_tokens
-- tienen además una política de SELECT para el dueño ("definer_lookup", TO CURRENT_USER: el rol que
-- corre la migración, que es el migrador). No le da nada que no tenga ya: el dueño puede alterar la
-- tabla. Los roles de aplicación no la tienen: sin tenant siguen viendo cero filas.

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "role_permissions" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "definer_lookup" ON "users" AS PERMISSIVE FOR SELECT TO CURRENT_USER
  USING (true);
--> statement-breakpoint
ALTER TABLE "user_branches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_branches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_branches" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "refresh_tokens" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "definer_lookup" ON "refresh_tokens" AS PERMISSIVE FOR SELECT TO CURRENT_USER
  USING (true);
--> statement-breakpoint
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "login_attempts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "login_attempts" AS PERMISSIVE FOR ALL
  USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
--> statement-breakpoint

-- Login sin tenant (ADR-BE-002, sub-decisión 2): por email normalizado, devuelve SOLO id, empresa,
-- hash y activo. Nada más de users es legible sin tenant.
CREATE FUNCTION "auth_find_user"(p_email text)
  RETURNS TABLE ("id" uuid, "empresa_id" uuid, "password_hash" text, "active" boolean)
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT u."id", u."empresa_id", u."password_hash", u."active"
    FROM "users" u
   WHERE u."email" = lower(btrim(p_email))
$$;
--> statement-breakpoint

-- Refresh sin tenant: por hash del token, devuelve SOLO lo necesario para rotarlo con el tenant ya
-- fijado (id, empresa, usuario, familia). El estado (usado, revocado, vencido) se lee y se escribe
-- después, dentro del tenant.
CREATE FUNCTION "auth_find_refresh_token"(p_token_hash text)
  RETURNS TABLE ("id" uuid, "empresa_id" uuid, "user_id" uuid, "family_id" uuid)
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT t."id", t."empresa_id", t."user_id", t."family_id"
    FROM "refresh_tokens" t
   WHERE t."token_hash" = p_token_hash
$$;
