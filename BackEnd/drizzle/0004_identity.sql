-- Identidad y permisos (ADR-BE-003, BE-1a). Generada por drizzle-kit, revisada a mano: sin "public".
-- Las FK de user_id en idempotency_keys y audit_log van NOT VALID: las filas que ya existen (de los
-- tests de BE-0b, con usuarios que no existían) no se validan; toda fila nueva sí. audit_log no se
-- puede corregir (append-only), así que validarlas no es posible.
CREATE TABLE "login_attempts" (
	"empresa_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"failed_count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "login_attempts_pk" PRIMARY KEY("empresa_id","user_id"),
	CONSTRAINT "login_attempts_failed_count_ck" CHECK ("login_attempts"."failed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_uk" UNIQUE("token_hash"),
	CONSTRAINT "refresh_tokens_token_hash_ck" CHECK ("refresh_tokens"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "role_permissions_role_module_action_uk" UNIQUE("empresa_id","role_id","module","action"),
	CONSTRAINT "role_permissions_module_ck" CHECK ("module" in ('analytics', 'cash', 'clients', 'compras', 'dashboard', 'inventory', 'logistics', 'orders', 'settings', 'suppliers')),
	CONSTRAINT "role_permissions_action_ck" CHECK ("action" in ('ver', 'crear', 'editar', 'anular', 'aprobar', 'exportar', 'forzar'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "roles_empresa_id_name_uk" UNIQUE("empresa_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_branches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "user_branches_user_branch_uk" UNIQUE("empresa_id","user_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"permissions_version" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "users_email_uk" UNIQUE("email"),
	CONSTRAINT "users_email_normalized_ck" CHECK ("users"."email" = lower(btrim("users"."email"))),
	CONSTRAINT "users_password_hash_ck" CHECK ("users"."password_hash" like '$argon2id$%')
);
--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_fk" FOREIGN KEY ("empresa_id","user_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_fk" FOREIGN KEY ("empresa_id","user_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_fk" FOREIGN KEY ("empresa_id","role_id") REFERENCES "roles"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_fk" FOREIGN KEY ("empresa_id","user_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_fk" FOREIGN KEY ("empresa_id","branch_id") REFERENCES "branches"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_fk" FOREIGN KEY ("empresa_id","role_id") REFERENCES "roles"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("empresa_id","family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("empresa_id","user_id");--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_fk" FOREIGN KEY ("empresa_id","user_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_fk" FOREIGN KEY ("empresa_id","user_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action NOT VALID;