import { ACTIONS, MODULES } from '@sdgpd/contracts'
import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { branches } from './branches.ts'
import { companies } from './companies.ts'

/**
 * Identidad y permisos (ADR-BE-003, BE-1a). Alcance EMPRESA (ADR-BE-002 §Alcances: usuarios y settings).
 * Todas con RLS forzado (migración 0005). Las FK son compuestas (empresa_id, id): una fila no puede
 * apuntar a una fila de otra empresa (ADR-BE-002 §Decisión 2).
 */

const moduleList = MODULES.map(m => `'${m}'`).join(', ')
const actionList = ACTIONS.map(a => `'${a}'`).join(', ')

/** Rol de una empresa (ADR-BE-003, sub-decisión 5): un rol por usuario; los 4 iniciales se siembran por empresa. */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [unique('roles_empresa_id_id_uk').on(t.empresaId, t.id), unique('roles_empresa_id_name_uk').on(t.empresaId, t.name)],
)

/**
 * Matriz módulo × acción de un rol (ADR-BE-003 §Decisión 4, sub-decisión 6): una fila por permiso
 * concedido. No es un agregado: su concurrencia la controla la `version` del rol.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id').notNull(),
    roleId: uuid('role_id').notNull(),
    module: text('module', { enum: MODULES }).notNull(),
    action: text('action', { enum: ACTIONS }).notNull(),
  },
  t => [
    foreignKey({ name: 'role_permissions_role_fk', columns: [t.empresaId, t.roleId], foreignColumns: [roles.empresaId, roles.id] }),
    unique('role_permissions_role_module_action_uk').on(t.empresaId, t.roleId, t.module, t.action),
    check('role_permissions_module_ck', sql.raw(`"module" in (${moduleList})`)),
    check('role_permissions_action_ck', sql.raw(`"action" in (${actionList})`)),
  ],
)

/**
 * Usuario (ADR-BE-003 §Decisión 2): pertenece a una sola empresa y el email es único GLOBAL
 * (sub-decisión 7), normalizado. `password_hash` es la cadena PHC de argon2id, con sus parámetros
 * (sub-decisión 8). `permissions_version` es el claim `ver` del access token: cambiarla invalida los
 * tokens emitidos antes.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    roleId: uuid('role_id').notNull(),
    active: boolean('active').notNull().default(true),
    permissionsVersion: integer('permissions_version').notNull().default(1),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [
    unique('users_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('users_email_uk').on(t.email),
    foreignKey({ name: 'users_role_fk', columns: [t.empresaId, t.roleId], foreignColumns: [roles.empresaId, roles.id] }),
    check('users_email_normalized_ck', sql`${t.email} = lower(btrim(${t.email}))`),
    check('users_password_hash_ck', sql`${t.passwordHash} like '$argon2id$%'`),
  ],
)

/** Sucursales habilitadas por usuario (ADR-BE-003, consecuencias; valida `branchId`, ADR-BE-002 §Decisión 3). */
export const userBranches = pgTable(
  'user_branches',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id').notNull(),
    userId: uuid('user_id').notNull(),
    branchId: uuid('branch_id').notNull(),
  },
  t => [
    foreignKey({ name: 'user_branches_user_fk', columns: [t.empresaId, t.userId], foreignColumns: [users.empresaId, users.id] }),
    foreignKey({
      name: 'user_branches_branch_fk',
      columns: [t.empresaId, t.branchId],
      foreignColumns: [branches.empresaId, branches.id],
    }),
    unique('user_branches_user_branch_uk').on(t.empresaId, t.userId, t.branchId),
  ],
)

/**
 * Refresh tokens (ADR-BE-003, sub-decisión 3): solo el SHA-256 del token, nunca el token. Rotan en
 * cada uso (`used_at`), y todos los de un login comparten `family_id`: presentar uno ya usado revoca la
 * familia entera. Sin tenant, solo los lee `auth_find_refresh_token` (SECURITY DEFINER, migración 0005).
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id').notNull(),
    userId: uuid('user_id').notNull(),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  },
  t => [
    foreignKey({ name: 'refresh_tokens_user_fk', columns: [t.empresaId, t.userId], foreignColumns: [users.empresaId, users.id] }),
    unique('refresh_tokens_token_hash_uk').on(t.tokenHash),
    index('refresh_tokens_family_idx').on(t.empresaId, t.familyId),
    index('refresh_tokens_user_idx').on(t.empresaId, t.userId),
    check('refresh_tokens_token_hash_ck', sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
)

/**
 * Intentos fallidos de login por usuario (= por email, que es único global), con bloqueo temporal.
 * Un email inexistente no deja fila: no hay cuenta que proteger, y la respuesta es la misma.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    empresaId: uuid('empresa_id').notNull(),
    userId: uuid('user_id').notNull(),
    failedCount: integer('failed_count').notNull(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true, mode: 'string' }).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'string' }),
  },
  t => [
    primaryKey({ name: 'login_attempts_pk', columns: [t.empresaId, t.userId] }),
    foreignKey({ name: 'login_attempts_user_fk', columns: [t.empresaId, t.userId], foreignColumns: [users.empresaId, users.id] }),
    check('login_attempts_failed_count_ck', sql`${t.failedCount} >= 0`),
  ],
)
