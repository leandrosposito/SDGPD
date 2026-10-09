// Suite de catálogo (ADR-BE-001 gate 4, ADR-BE-002): enumera las tablas desde pg_catalog, así que
// cubre cualquier tabla futura sin tocar este archivo. Corre como sdgpd_app_test.
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEV_ROLE, DEV_SCHEMA, rawTestClient, TEST_ROLE, TEST_SCHEMA } from '../support/db.ts'

/** Tablas exentas de empresa_id: companies (su id es el tenant) y la de control de migraciones. */
const NO_EMPRESA_ID = new Set(['companies', 'schema_migrations'])
/** La tabla de control no es de negocio: no lleva RLS, y los roles de aplicación no tienen privilegios sobre ella. */
const CONTROL_TABLE = 'schema_migrations'
const APP_ROLES = [DEV_ROLE, TEST_ROLE]
const FOREIGN_ROLES = ['public', 'anon', 'authenticated', 'service_role']
const SCHEMAS = [DEV_SCHEMA, TEST_SCHEMA]
const TABLE_PRIVILEGES = 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
/** Tablas append-only (scripts/db/lib.ts, APPEND_ONLY_TABLES): los roles de aplicación solo leen e insertan. */
const APPEND_ONLY = ['audit_log']

type TableRow = {
  schema: string
  name: string
  rls: boolean
  force: boolean
  policies: number
  empresaIdNotNull: boolean | null
}

let client: pg.Client
let tables: TableRow[]

beforeAll(async () => {
  client = await rawTestClient()
  tables = (
    await client.query<TableRow>(
      `select n.nspname as schema, c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force,
              (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies,
              (select a.attnotnull from pg_attribute a
                where a.attrelid = c.oid and a.attname = 'empresa_id' and not a.attisdropped) as "empresaIdNotNull"
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = any($1) and c.relkind in ('r', 'p')
        order by 1, 2`,
      [SCHEMAS],
    )
  ).rows
})

afterAll(async () => {
  await client.end()
})

describe(`catálogo de ${TEST_SCHEMA}`, () => {
  const businessTables = (): TableRow[] => tables.filter(t => t.schema === TEST_SCHEMA && t.name !== CONTROL_TABLE)

  it('hay tablas que revisar (la suite no pasa en vacío)', () => {
    expect(businessTables().map(t => t.name)).toEqual(expect.arrayContaining(['companies', 'branches']))
  })

  it('toda tabla, salvo companies y la de control, tiene empresa_id NOT NULL', () => {
    const offenders = businessTables()
      .filter(t => !NO_EMPRESA_ID.has(t.name) && t.empresaIdNotNull !== true)
      .map(t => t.name)
    expect(offenders).toEqual([])
  })

  it('toda tabla de negocio (incluida companies) tiene RLS habilitado y forzado y al menos una política', () => {
    const offenders = businessTables()
      .filter(t => !t.rls || !t.force || t.policies < 1)
      .map(t => `${t.name} (rls=${t.rls}, force=${t.force}, políticas=${t.policies})`)
    expect(offenders).toEqual([])
  })

  it('los dos schemas tienen las mismas tablas (las mismas migraciones)', () => {
    const names = (schema: string): string[] => tables.filter(t => t.schema === schema).map(t => t.name)
    expect(names(DEV_SCHEMA)).toEqual(names(TEST_SCHEMA))
  })
})

describe('roles de aplicación', () => {
  it('ni sdgpd_app ni sdgpd_app_test tienen BYPASSRLS ni son superusuarios', async () => {
    const { rows } = await client.query<{ rolname: string; rolbypassrls: boolean; rolsuper: boolean }>(
      'select rolname, rolbypassrls, rolsuper from pg_roles where rolname = any($1) order by rolname',
      [APP_ROLES],
    )
    expect(rows).toEqual([
      { rolname: DEV_ROLE, rolbypassrls: false, rolsuper: false },
      { rolname: TEST_ROLE, rolbypassrls: false, rolsuper: false },
    ])
  })

  it('no son dueños de ninguna tabla ni de ningún schema, en ninguna parte de la base', async () => {
    const { rows } = await client.query<{ owner: string; object: string }>(
      `select pg_get_userbyid(c.relowner) as owner, c.oid::regclass::text as object
         from pg_class c where pg_get_userbyid(c.relowner) = any($1)
       union all
       select pg_get_userbyid(n.nspowner), n.nspname from pg_namespace n where pg_get_userbyid(n.nspowner) = any($1)`,
      [APP_ROLES],
    )
    expect(rows).toEqual([])
  })

  it('cada rol de aplicación solo tiene privilegios sobre su propio schema', async () => {
    const { rows } = await client.query<{ role: string; schema: string; usage: boolean; create: boolean }>(
      `select r as role, s as schema, has_schema_privilege(r, s, 'USAGE') as usage, has_schema_privilege(r, s, 'CREATE') as create
         from unnest($1::text[]) r cross join unnest($2::text[]) s order by 1, 2`,
      [APP_ROLES, SCHEMAS],
    )
    expect(rows).toEqual([
      { role: DEV_ROLE, schema: DEV_SCHEMA, usage: true, create: false },
      { role: DEV_ROLE, schema: TEST_SCHEMA, usage: false, create: false },
      { role: TEST_ROLE, schema: DEV_SCHEMA, usage: false, create: false },
      { role: TEST_ROLE, schema: TEST_SCHEMA, usage: true, create: false },
    ])
  })

  it('ningún rol de aplicación tiene privilegios sobre la tabla de control de migraciones', async () => {
    const { rows } = await client.query<{ role: string; schema: string }>(
      `select r as role, n.nspname as schema
         from unnest($1::text[]) r
         cross join pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = any($2) and c.relname = $3 and has_table_privilege(r, c.oid, $4)`,
      [APP_ROLES, SCHEMAS, CONTROL_TABLE, TABLE_PRIVILEGES],
    )
    expect(rows).toEqual([])
  })
})

describe('tablas append-only', () => {
  it('en los dos schemas, los roles de aplicación tienen INSERT y SELECT, y no UPDATE, DELETE ni TRUNCATE', async () => {
    const { rows } = await client.query<{ role: string; schema: string; table: string; privileges: string }>(
      `select r as role, n.nspname as schema, c.relname as table,
              concat_ws(',',
                case when has_table_privilege(r, c.oid, 'SELECT') then 'SELECT' end,
                case when has_table_privilege(r, c.oid, 'INSERT') then 'INSERT' end,
                case when has_table_privilege(r, c.oid, 'UPDATE') then 'UPDATE' end,
                case when has_table_privilege(r, c.oid, 'DELETE') then 'DELETE' end,
                case when has_table_privilege(r, c.oid, 'TRUNCATE') then 'TRUNCATE' end) as privileges
         from unnest($1::text[]) r
         cross join pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = any($2) and c.relname = any($3)
        order by 1, 2, 3`,
      [APP_ROLES, SCHEMAS, APPEND_ONLY],
    )
    expect(rows).toEqual([
      { role: DEV_ROLE, schema: DEV_SCHEMA, table: 'audit_log', privileges: 'SELECT,INSERT' },
      { role: DEV_ROLE, schema: TEST_SCHEMA, table: 'audit_log', privileges: '' },
      { role: TEST_ROLE, schema: DEV_SCHEMA, table: 'audit_log', privileges: '' },
      { role: TEST_ROLE, schema: TEST_SCHEMA, table: 'audit_log', privileges: 'SELECT,INSERT' },
    ])
  })
})

describe('roles de Supabase y PUBLIC', () => {
  it('anon, authenticated, service_role y PUBLIC no tienen ningún privilegio sobre sdgpd ni sdgpd_test', async () => {
    const existing = (
      await client.query<{ rolname: string }>('select rolname from pg_roles where rolname = any($1)', [FOREIGN_ROLES])
    ).rows.map(r => r.rolname)
    const roles = ['public', ...existing]
    const schemaGrants = await client.query<{ role: string; schema: string }>(
      `select r as role, s as schema from unnest($1::text[]) r cross join unnest($2::text[]) s
        where has_schema_privilege(r, s, 'USAGE') or has_schema_privilege(r, s, 'CREATE')`,
      [roles, SCHEMAS],
    )
    const tableGrants = await client.query<{ role: string; object: string }>(
      `select r as role, c.oid::regclass::text as object
         from unnest($1::text[]) r
         cross join pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = any($2) and c.relkind in ('r', 'p', 'v', 'm', 'S')
          and has_table_privilege(r, c.oid, $3)`,
      [roles, SCHEMAS, TABLE_PRIVILEGES],
    )
    expect({ schemas: schemaGrants.rows, tables: tableGrants.rows }).toEqual({ schemas: [], tables: [] })
    // En Supabase estos roles existen: si no aparecen, el chequeo no estaría mirando lo que dice mirar.
    expect(existing).toEqual(expect.arrayContaining(['anon', 'authenticated']))
  })
})
