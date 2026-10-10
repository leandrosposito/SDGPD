CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"licencia" text NOT NULL,
	"licencia_normalized" text GENERATED ALWAYS AS (upper(regexp_replace("drivers"."licencia", '[^A-Za-z0-9]', '', 'g'))) STORED NOT NULL,
	"telefono" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"usuario_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "drivers_licencia_uk" UNIQUE("empresa_id","licencia_normalized"),
	CONSTRAINT "drivers_usuario_uk" UNIQUE("empresa_id","usuario_id"),
	CONSTRAINT "drivers_licencia_ck" CHECK (length("drivers"."licencia_normalized") >= 3)
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
	CONSTRAINT "motivos_tipo_ck" CHECK ("tipo" in ('rechazo', 'reprogramacion', 'no-entrega')),
	CONSTRAINT "motivos_codigo_ck" CHECK ("motivos"."codigo" ~ '^[A-Z][A-Z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cuit" text NOT NULL,
	"cuit_normalized" text GENERATED ALWAYS AS (regexp_replace("suppliers"."cuit", '[^0-9]', '', 'g')) STORED NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"payment_terms" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "suppliers_cuit_uk" UNIQUE("empresa_id","cuit_normalized"),
	CONSTRAINT "suppliers_cuit_ck" CHECK ("suppliers"."cuit_normalized" ~ '^[0-9]{11}$')
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"patente" text NOT NULL,
	"tipo" text NOT NULL,
	"capacidad_bultos" integer NOT NULL,
	"capacidad_peso_kg" double precision NOT NULL,
	"capacidad_volumen_m3" double precision NOT NULL,
	"capacidad_refrigerado" boolean NOT NULL,
	"capacidad_zonas_habilitadas" text[] NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_empresa_id_id_uk" UNIQUE("empresa_id","id"),
	CONSTRAINT "vehicles_patente_uk" UNIQUE("empresa_id","patente"),
	CONSTRAINT "vehicles_patente_normalized_ck" CHECK ("vehicles"."patente" ~ '^[A-Z0-9]{5,10}$'),
	CONSTRAINT "vehicles_capacidad_ck" CHECK ("vehicles"."capacidad_bultos" >= 0 and "vehicles"."capacidad_peso_kg" >= 0 and "vehicles"."capacidad_volumen_m3" >= 0 and cardinality("vehicles"."capacidad_zonas_habilitadas") >= 1)
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_usuario_fk" FOREIGN KEY ("empresa_id","usuario_id") REFERENCES "users"("empresa_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motivos" ADD CONSTRAINT "motivos_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_empresa_id_companies_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;