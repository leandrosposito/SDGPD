import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from './schema/index.ts'

export type Db = NodePgDatabase<typeof schema>
/** Transacción cruda con el tenant ya fijado. Solo la ve src/db/: el resto recibe CommandTx o ReadTx. */
export type TenantTx = Parameters<Parameters<Db['transaction']>[0]>[0]
