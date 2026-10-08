// Ejecuta SQL como uno de los roles propios, sin psql. Para verificaciones manuales.
// Cada sentencia se ejecuta por separado y se imprime su resultado o su error; un error no corta
// las siguientes. Con --tenant, todo corre en UNA transacción con app.empresa_id fijado
// (como Database.withTenant) y al final se hace ROLLBACK, salvo que se pase --commit.
// Uso: npm run db:sql -w @sdgpd/backend -- <migrator|app|app_test> [--tenant <uuid> [--commit]] "<sql>" ["<sql>" ...]
import { connectAs, isRoleKey, pgErrorText, ROLE_KEYS } from './lib.ts'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const role = args.shift()
  if (role === undefined || !isRoleKey(role)) {
    throw new Error(`uso: db:sql -- <${ROLE_KEYS.join('|')}> [--tenant <uuid> [--commit]] "<sql>" ...`)
  }
  let tenant: string | undefined
  if (args[0] === '--tenant') {
    args.shift()
    tenant = args.shift()
    if (tenant === undefined) throw new Error('--tenant necesita un uuid')
  }
  const commit = args[0] === '--commit'
  if (commit) args.shift()
  const client = await connectAs(role)
  try {
    const who = await client.query<{ u: string; s: string | null }>('select current_user as u, current_schema() as s')
    console.log(`# conectado como ${who.rows[0]?.u}, schema por defecto ${who.rows[0]?.s ?? '(ninguno)'}${tenant ? `, tenant ${tenant} (${commit ? 'commit' : 'rollback'} al final)` : ', sin tenant'}`)
    if (tenant !== undefined) {
      await client.query('begin')
      await client.query(`select set_config('app.empresa_id', $1, true)`, [tenant])
    }
    for (const [i, statement] of args.entries()) {
      console.log(`\n> ${statement}`)
      if (tenant !== undefined) await client.query(`savepoint s${i}`)
      try {
        const result = await client.query(statement)
        if (result.rows.length > 0) console.table(result.rows)
        console.log(`${result.command} ${result.rowCount ?? ''}`.trim())
      } catch (err) {
        console.log(`ERROR ${pgErrorText(err)}`)
        if (tenant !== undefined) await client.query(`rollback to savepoint s${i}`)
      }
    }
    if (tenant !== undefined) await client.query(commit ? 'commit' : 'rollback')
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error(`db:sql falló: ${pgErrorText(err)}`)
  process.exit(1)
})
