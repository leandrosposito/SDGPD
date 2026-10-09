CREATE TABLE "idempotency_keys" (
	"empresa_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_pk" PRIMARY KEY("empresa_id","user_id","operation","key")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"request_id" uuid NOT NULL,
	CONSTRAINT "audit_log_action_ck" CHECK ("audit_log"."action" in ('create', 'update', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "document_counters" (
	"empresa_id" uuid NOT NULL,
	"series" text NOT NULL,
	"last_value" bigint NOT NULL,
	CONSTRAINT "document_counters_pk" PRIMARY KEY("empresa_id","series"),
	CONSTRAINT "document_counters_series_ck" CHECK ("document_counters"."series" in ('PED', 'REM', 'OC', 'REC', 'VIA', 'RCB')),
	CONSTRAINT "document_counters_last_value_ck" CHECK ("document_counters"."last_value" >= 1)
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "audit_log_empresa_at_id_idx" ON "audit_log" USING btree ("empresa_id","at","id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("empresa_id","entity","entity_id");