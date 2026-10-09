// Seed de desarrollo (BE-1a). Idempotente: se puede correr las veces que haga falta. Corre SOLO contra
// sdgpd como sdgpd_app (DATABASE_URL), nunca contra sdgpd_test: lo verifica antes de escribir.
// Crea (o completa, sin pisar lo que ya editaste):
//   - la empresa A con las 4 sucursales del mock del frontend (FrontEnd/src/data/mock/session.mock.ts),
//     los 4 roles iniciales y un usuario Admin con las 4 sucursales habilitadas;
//   - la empresa B con una sucursal y su propio Admin, para probar el aislamiento a mano.
// Los ids de las empresas, los emails y las contraseñas de los admins se generan la primera vez y
// quedan SOLO en BackEnd/.env (SEED_*). Nunca se imprimen. Si la contraseña de un admin no coincide
// con la de .env, se vuelve a hashear con la de .env.
// Las filas del seed no pasan por audit_log: no hay actor todavía (es preparación de datos).
// Uso: npm run db:seed-dev -w @sdgpd/backend
import { randomBytes } from 'node:crypto'
import type pg from 'pg'
import { v7 } from 'uuid'
import { DEFAULT_ROLES } from '../../src/auth/default-roles.ts'
import { hashPassword, verifyPassword } from '../../src/auth/passwords.ts'
import { connectAs, envValue, pgErrorText, readEnvFile, ROLES, SCHEMAS, writeEnvValues } from './lib.ts'

type SeedBranch = { name: string; code: string; city: string; address: string; status: 'active' | 'inactive' }
type SeedCompany = { idVar: string; emailVar: string; passwordVar: string; name: string; branches: SeedBranch[] }

/** Las 4 sucursales del mock de sesión del frontend: mismos nombres, códigos, ciudades y estado. */
const MOCK_BRANCHES: SeedBranch[] = [
  { name: 'Sucursal Centro', code: 'CTR', city: 'Cordoba', address: 'Av. Colon 1234', status: 'active' },
  { name: 'Sucursal Norte', code: 'NOR', city: 'Cordoba', address: 'Av. Rafael Nunez 4567', status: 'active' },
  { name: 'Sucursal Sur', code: 'SUR', city: 'Cordoba', address: 'Bv. Los Granaderos 890', status: 'active' },
  { name: 'Sucursal Villa Maria (cerrada)', code: 'VMA', city: 'Villa Maria', address: 'Av. San Martin 210', status: 'inactive' },
]

const COMPANIES: SeedCompany[] = [
  {
    idVar: 'SEED_EMPRESA_ID',
    emailVar: 'SEED_ADMIN_EMAIL',
    passwordVar: 'SEED_ADMIN_PASSWORD',
    name: 'Distribuidora La Proveedora S.A.',
    branches: MOCK_BRANCHES,
  },
  {
    idVar: 'SEED_EMPRESA_B_ID',
    emailVar: 'SEED_ADMIN_B_EMAIL',
    passwordVar: 'SEED_ADMIN_B_PASSWORD',
    name: 'Empresa B (aislamiento)',
    branches: [{ name: 'Casa Central B', code: 'BCC', city: 'Rosario', address: 'Calle Falsa 123', status: 'active' }],
  },
]
const TIMEZONE = 'America/Argentina/Cordoba'

/** Valores de .env que faltan: ids v7, emails y contraseñas aleatorios. Se escriben ANTES de tocar la base. */
function ensureSeedEnv(): Record<string, string> {
  const lines = readEnvFile()
  const values: Record<string, string> = {}
  const missing: Record<string, string> = {}
  for (const company of COMPANIES) {
    const suffix = randomBytes(4).toString('hex')
    const generated: Record<string, string> = {
      [company.idVar]: v7(),
      [company.emailVar]: `admin.${company.idVar === 'SEED_EMPRESA_ID' ? 'a' : 'b'}.${suffix}@sdgpd.local`,
      [company.passwordVar]: randomBytes(18).toString('base64url'),
    }
    for (const [key, value] of Object.entries(generated)) {
      const current = envValue(lines, key)
      if (current === undefined || current === '') missing[key] = value
      values[key] = current === undefined || current === '' ? value : current
    }
  }
  if (Object.keys(missing).length > 0) writeEnvValues(missing)
  return values
}

async function seedCompany(client: pg.Client, company: SeedCompany, env: Record<string, string>): Promise<string> {
  const empresaId = env[company.idVar] ?? ''
  const email = (env[company.emailVar] ?? '').trim().toLowerCase()
  const password = env[company.passwordVar] ?? ''
  await client.query('begin')
  try {
    await client.query(`select set_config('app.empresa_id', $1, true)`, [empresaId])
    await client.query('insert into companies (id, name, timezone) values ($1, $2, $3) on conflict (id) do nothing', [
      empresaId,
      company.name,
      TIMEZONE,
    ])
    for (const b of company.branches) {
      await client.query(
        `insert into branches (id, empresa_id, name, code, city, address, status) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (empresa_id, code) do nothing`,
        [v7(), empresaId, b.name, b.code, b.city, b.address, b.status],
      )
    }
    const roleIds = new Map<string, string>()
    for (const role of DEFAULT_ROLES) {
      await client.query('insert into roles (id, empresa_id, name) values ($1, $2, $3) on conflict (empresa_id, name) do nothing', [
        v7(),
        empresaId,
        role.name,
      ])
      const { rows } = await client.query<{ id: string }>('select id from roles where name = $1', [role.name])
      const roleId = rows[0]?.id
      if (roleId === undefined) throw new Error(`el rol ${role.name} no quedó visible`)
      roleIds.set(role.name, roleId)
      // Solo agrega lo que falta: si editaste la matriz de un rol (salvo Admin, que siempre tiene todo), no se pisa.
      for (const p of role.permissions) {
        await client.query(
          `insert into role_permissions (id, empresa_id, role_id, module, action) values ($1, $2, $3, $4, $5)
           on conflict (empresa_id, role_id, module, action) do nothing`,
          [v7(), empresaId, roleId, p.module, p.action],
        )
      }
    }
    const adminRoleId = roleIds.get('Admin')
    if (adminRoleId === undefined) throw new Error('falta el rol Admin')
    const existing = await client.query<{ id: string; password_hash: string }>('select id, password_hash from users where email = $1', [email])
    let userId = existing.rows[0]?.id
    if (userId === undefined) {
      userId = v7()
      await client.query(
        `insert into users (id, empresa_id, email, full_name, password_hash, role_id) values ($1, $2, $3, $4, $5, $6)`,
        [userId, empresaId, email, `Admin ${company.name}`, await hashPassword(password), adminRoleId],
      )
    } else if (!(await verifyPassword(existing.rows[0]?.password_hash ?? '', password))) {
      await client.query('update users set password_hash = $1 where id = $2', [await hashPassword(password), userId])
    }
    // El admin del seed tiene habilitadas todas las sucursales de su empresa (ids v7, como todo id).
    const branchIds = await client.query<{ id: string }>('select id from branches order by code')
    for (const { id: branchId } of branchIds.rows) {
      await client.query(
        `insert into user_branches (id, empresa_id, user_id, branch_id) values ($1, $2, $3, $4)
         on conflict (empresa_id, user_id, branch_id) do nothing`,
        [v7(), empresaId, userId, branchId],
      )
    }
    const counts = await client.query<{ branches: number; roles: number }>(
      'select (select count(*) from branches)::int as branches, (select count(*) from roles)::int as roles',
    )
    await client.query('commit')
    const c = counts.rows[0]
    return `${company.name}: ${c?.branches ?? '?'} sucursales, ${c?.roles ?? '?'} roles, admin con email en ${company.emailVar} y contraseña en ${company.passwordVar} (BackEnd/.env)`
  } catch (err) {
    await client.query('rollback').catch(() => undefined)
    throw err
  }
}

async function main(): Promise<void> {
  const client = await connectAs('app')
  try {
    const who = await client.query<{ u: string; s: string | null }>('select current_user as u, current_schema() as s')
    const row = who.rows[0]
    if (row?.u !== ROLES.app.name || row.s !== SCHEMAS.dev) {
      throw new Error(`el seed corre solo como ${ROLES.app.name} sobre ${SCHEMAS.dev}; la conexión es ${row?.u ?? '?'} sobre ${row?.s ?? '?'}`)
    }
    const env = ensureSeedEnv()
    for (const company of COMPANIES) console.log(`ok  ${await seedCompany(client, company, env)}`)
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error(`seed-dev falló: ${pgErrorText(err)}`)
  process.exitCode = 1
})
