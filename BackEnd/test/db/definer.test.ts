// Las dos funciones SECURITY DEFINER del login y del refresh (ADR-BE-002, sub-decisión 2; BE-1a):
// son la ÚNICA lectura de users y refresh_tokens sin tenant, y devuelven solo sus columnas.
// Corre como sdgpd_app_test, sin tenant (rawTestClient), salvo para preparar los datos.
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Database } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { refreshTokens } from '../../src/db/schema/index.ts'
import { DEV_ROLE, rawTestClient, TEST_ROLE, TEST_SCHEMA, testConfig } from '../support/db.ts'
import { createTestCompany, removeTestCompany, type TestTenant } from '../support/tenants.ts'

const MIGRATOR = 'sdgpd_migrator'

let db: Database
let raw: pg.Client
let A: TestTenant
let email: string
let tokenHash: string
let familyId: string

beforeAll(async () => {
  db = new Database(testConfig())
  raw = await rawTestClient()
  A = await createTestCompany(db, 'definer')
  tokenHash = createHash('sha256').update(newId()).digest('hex')
  familyId = newId()
  email = await db.withTenant(A.empresaId, async tx => {
    await tx.insert(refreshTokens).values({
      id: newId(),
      empresaId: A.empresaId,
      userId: A.userId,
      familyId,
      tokenHash,
      expiresAt: sql`now() + interval '1 day'`,
    })
    const rows = await tx.execute<{ email: string }>(sql`select email from users where id = ${A.userId}`)
    return rows.rows[0]?.email ?? ''
  })
})

afterAll(async () => {
  try {
    await removeTestCompany(db, A)
  } finally {
    await raw?.end()
    await db?.close()
  }
})

describe('sin tenant (como sdgpd_app_test)', () => {
  it('SELECT sobre users y refresh_tokens: 0 filas, aunque existen', async () => {
    const users = await raw.query<{ n: number }>('select count(*)::int as n from users')
    const tokens = await raw.query<{ n: number }>('select count(*)::int as n from refresh_tokens')
    expect([users.rows[0]?.n, tokens.rows[0]?.n]).toEqual([0, 0])
    const inside = await db.withTenant(A.empresaId, tx =>
      tx.execute<{ n: number }>(sql`select (select count(*) from users)::int + (select count(*) from refresh_tokens)::int as n`),
    )
    expect(inside.rows[0]?.n).toBe(2)
  })

  it('auth_find_user devuelve SOLO id, empresa_id, password_hash y active', async () => {
    const res = await raw.query<{ id: string; empresa_id: string; password_hash: string; active: boolean }>(
      'select * from auth_find_user($1)',
      [`  ${email.toUpperCase()}  `],
    )
    expect(res.fields.map(f => f.name)).toEqual(['id', 'empresa_id', 'password_hash', 'active'])
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({ id: A.userId, empresa_id: A.empresaId, active: true })
    expect(res.rows[0]?.password_hash).toMatch(/^\$argon2id\$/)
    expect((await raw.query('select * from auth_find_user($1)', ['nadie@sdgpd.test'])).rows).toEqual([])
  })

  it('auth_find_refresh_token devuelve SOLO id, empresa_id, user_id y family_id (nunca el hash)', async () => {
    const res = await raw.query('select * from auth_find_refresh_token($1)', [tokenHash])
    expect(res.fields.map(f => f.name)).toEqual(['id', 'empresa_id', 'user_id', 'family_id'])
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({ empresa_id: A.empresaId, user_id: A.userId, family_id: familyId })
    expect((await raw.query('select * from auth_find_refresh_token($1)', ['0'.repeat(64)])).rows).toEqual([])
  })

  it('la política definer_lookup (la que deja leer sin tenant a las funciones) es solo del dueño, el migrador', async () => {
    const { rows } = await raw.query<{ table: string; roles: string }>(
      `select polrelid::regclass::text as table, polroles::regrole[]::text as roles
         from pg_policy where polname = 'definer_lookup' and polrelid::regclass::text in ('users', 'refresh_tokens')
        order by 1`,
    )
    expect(rows).toEqual([
      { table: 'refresh_tokens', roles: `{${MIGRATOR}}` },
      { table: 'users', roles: `{${MIGRATOR}}` },
    ])
  })
})

describe('catálogo de las funciones', () => {
  it('SECURITY DEFINER, search_path fijo (<schema>, pg_temp), dueño el migrador, EXECUTE solo para el rol de aplicación', async () => {
    const { rows } = await raw.query<{ name: string; definer: boolean; config: string[] | null; owner: string; acl: string | null }>(
      `select p.proname as name, p.prosecdef as definer, p.proconfig as config,
              pg_get_userbyid(p.proowner) as owner, p.proacl::text as acl
         from pg_proc p where p.pronamespace = $1::regnamespace and p.proname like 'auth\\_%' order by 1`,
      [TEST_SCHEMA],
    )
    expect(rows).toEqual(
      ['auth_find_refresh_token', 'auth_find_user'].map(name => ({
        name,
        definer: true,
        config: [`search_path=${TEST_SCHEMA}, pg_temp`],
        owner: MIGRATOR,
        acl: `{${MIGRATOR}=X/${MIGRATOR},${TEST_ROLE}=X/${MIGRATOR}}`,
      })),
    )
  })

  it('PUBLIC y el rol del otro schema no pueden ejecutarlas', async () => {
    const { rows } = await raw.query<{ role: string; fn: string; can: boolean }>(
      `select r as role, p.proname as fn, has_function_privilege(r, p.oid, 'EXECUTE') as can
         from unnest($1::text[]) r cross join pg_proc p
        where p.pronamespace = $2::regnamespace and p.proname like 'auth\\_%' order by 1, 2`,
      [['public', DEV_ROLE], TEST_SCHEMA],
    )
    expect(rows.every(r => !r.can)).toBe(true)
    expect(rows).toHaveLength(4)
  })
})
