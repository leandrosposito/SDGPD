// globalSetup de Vitest: si la conexión de tests no es la de sdgpd_app_test sobre sdgpd_test,
// la corrida no arranca. Evita correr la suite (que crea y borra datos) contra otra base o rol.
import { rawTestClient, TEST_ROLE, TEST_SCHEMA } from '../support/db.ts'

export default async function guard(): Promise<void> {
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error('Los tests se niegan a arrancar: falta DATABASE_URL_TEST (ver BackEnd/docs/SETUP_SUPABASE.md)')
  }
  const client = await rawTestClient()
  try {
    const { rows } = await client.query<{ user: string; schema: string | null }>(
      'select current_user as "user", current_schema() as schema',
    )
    const user = rows[0]?.user
    const schema = rows[0]?.schema ?? null
    if (user !== TEST_ROLE || schema !== TEST_SCHEMA) {
      throw new Error(
        `Los tests se niegan a arrancar: la conexión es ${user ?? '?'} sobre ${schema ?? '(sin schema)'}, ` +
          `y tiene que ser ${TEST_ROLE} sobre ${TEST_SCHEMA}. Revisá DATABASE_URL_TEST.`,
      )
    }
  } finally {
    await client.end()
  }
}
