CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "branches_empresa_id_code_uk" UNIQUE("empresa_id","code"),
	CONSTRAINT "branches_status_ck" CHECK ("branches"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;