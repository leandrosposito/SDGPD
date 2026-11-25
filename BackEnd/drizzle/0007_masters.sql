CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"licencia" text NOT NULL,
	"telefono" text DEFAULT '' NOT NULL,
	"usuario_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_empresa_id_id_uk" UNIQUE("empresa_id","id")
);
--> statement-breakpoint
CREATE TABLE "motivos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"tipo" text NOT NULL,
	"descripcion" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"requiere_evidencia" boolean DEFAULT false NOT NULL,
	"dispara_logistica_inversa" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motivos_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "motivos_tipo_codigo_uk" UNIQUE("empresa_id","tipo","codigo"),
	CONSTRAINT "motivos_tipo_ck" CHECK ("tipo" in ('rechazo', 'reprogramacion', 'no-entrega'))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cuit" text NOT NULL,
	"cuit_digits" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"payment_terms" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "suppliers_cuit_uk" UNIQUE("empresa_id","cuit_digits"),
	CONSTRAINT "suppliers_cuit_digits_ck" CHECK ("suppliers"."cuit_digits" ~ '^[0-9]{11}$')
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"patente" text NOT NULL,
	"tipo" text NOT NULL,
	"bultos" integer NOT NULL,
	"peso_kg" double precision NOT NULL,
	"volumen_m3" double precision NOT NULL,
	"refrigerado" boolean NOT NULL,
	"zonas_habilitadas" text[] NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "vehicles_patente_uk" UNIQUE("empresa_id","patente"),
	CONSTRAINT "vehicles_capacity_ck" CHECK ("vehicles"."bultos" >= 0 and "vehicles"."peso_kg" >= 0 and "vehicles"."volumen_m3" >= 0)
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_usuario_fk" FOREIGN KEY ("empresa_id","usuario_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motivos" ADD CONSTRAINT "motivos_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drivers_empresa_nombre_idx" ON "drivers" USING btree ("empresa_id","nombre");--> statement-breakpoint
CREATE INDEX "suppliers_empresa_name_idx" ON "suppliers" USING btree ("empresa_id","name");--> statement-breakpoint
CREATE INDEX "vehicles_empresa_patente_idx" ON "vehicles" USING btree ("empresa_id","patente");