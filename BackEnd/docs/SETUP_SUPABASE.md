# Setup del entorno: Postgres en Supabase

**Fecha:** 2026-10-08 (tanda BE-0a). ADR-BE-001, sub-decisión 3, y ADR-BE-002, sub-decisiones 8 a 12.

Supabase se usa **solo como Postgres administrado**: nada de Auth, ni de la API de datos (PostgREST), ni de Storage, ni de la CLI de Supabase. Este documento no tiene ningún valor real: ni ref, ni host, ni contraseñas. Los valores viven solo en `BackEnd/.env` (no versionado) y en las variables de entorno de la máquina.

## 1. Qué crear en Supabase

1. **Un proyecto.** Desarrollo y tests comparten el proyecto, en schemas separados: `sdgpd` y `sdgpd_test`. Los crea el setup, no se crean a mano.
2. **No agregar `sdgpd` ni `sdgpd_test` a los schemas expuestos de la API** (Project Settings › Data API › Exposed schemas). Tienen que quedar fuera.
3. **El certificado CA del proyecto**: Project Settings › Database › SSL Configuration › Download certificate. Guardalo **fuera del repo**.
4. **La contraseña de `postgres`**: Project Settings › Database. Si alguna vez se pegó en un chat o en un archivo, reseteala.
5. **El host del session pooler**: botón Connect › Session pooler. Usá el **puerto 5432**, no el 6543 del transaction pooler: `set_config(..., true)` necesita la transacción entera en la misma conexión. El host directo del proyecto puede resolver solo a IPv6. Si tu red no tiene IPv6, el pooler es la única opción. Con el pooler, cada usuario es `<rol>.<project-ref>`.

## 2. Variables de entorno

**De la máquina** (no van en ningún archivo del repo):

| Variable | Qué es |
|---|---|
| `SUPABASE_DB_PASSWORD` | contraseña de `postgres`. La lee solo `scripts/db/setup.ts` |
| `SUPABASE_CA_CERT` | ruta al certificado CA (opcional: lo que importa es `DATABASE_CA_CERT` en `.env`) |

**De `BackEnd/.env`** (copiá `BackEnd/.env.example`; git lo ignora):

| Variable | La escribe | Para qué |
|---|---|---|
| `PORT` | vos | puerto HTTP del backend |
| `DATABASE_CA_CERT` | vos | ruta al certificado CA (en Windows, con `/`). Todo el SSL se verifica contra este archivo |
| `DB_HOST` | vos | host del session pooler |
| `DB_PORT` | vos | `5432` |
| `DB_NAME` | vos | `postgres` |
| `SUPABASE_PROJECT_REF` | vos | ref del proyecto: arma los usuarios `<rol>.<ref>`. Vacía si te conectás sin pooler |
| `DATABASE_URL` | el setup | rol `sdgpd_app`, schema `sdgpd`. La usa el backend |
| `DATABASE_URL_TEST` | el setup | rol `sdgpd_app_test`, schema `sdgpd_test`. La usan los tests |
| `DATABASE_URL_MIGRATOR` | el setup | rol `sdgpd_migrator`. La usan las migraciones |
| `JWT_SECRET` | el setup (BE-1a) | clave HS256 del access token, 32 bytes aleatorios en base64url. Sin ella el backend no arranca. Nunca se imprime ni se versiona |
| `SEED_EMPRESA_ID`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` y sus `_B_` | `db:seed-dev` (BE-1a) | ids de las dos empresas del seed y credenciales de sus admins. Solo para desarrollo, contra `sdgpd` |

Las URLs **no llevan parámetros de SSL**: el backend las rechaza, porque el SSL lo fija la aplicación, siempre verificado.

## 3. Cómo correr el setup

Desde la raíz del repo, con Node 24:

```
npm ci
npm run db:setup -w @sdgpd/backend      # roles, schemas, privilegios y URLs en BackEnd/.env
npm run db:migrate -w @sdgpd/backend    # las mismas migraciones en sdgpd y sdgpd_test
```

- **`db:setup`** es idempotente: se puede correr de nuevo cuando quieras, y reusa las contraseñas que ya están en `.env`. Al terminar, verifica que los tres roles se conectan y muestra el schema por defecto de cada uno. Si alguno no se conecta, termina con error. Desde BE-1a, también genera `JWT_SECRET` si falta; con `npm run db:setup -w @sdgpd/backend -- --secrets-only` hace **solo** eso, sin conectarse a la base (no pide `SUPABASE_DB_PASSWORD`).
- **`db:setup` y `db:migrate`** fijan además, en las funciones `SECURITY DEFINER` del login y del refresh (`DEFINER_FUNCTIONS` en `scripts/db/lib.ts`), el `search_path` (`<schema>, pg_temp`) y el `EXECUTE` (solo el rol de aplicación de ese schema), porque una migración no puede nombrar schemas ni roles.
- **`npm run db:seed-dev -w @sdgpd/backend`** (BE-1a) siembra `sdgpd` (nunca `sdgpd_test`: lo verifica y se niega): la empresa A con las 4 sucursales del mock del frontend, los 4 roles iniciales y un Admin, y la empresa B con su Admin. Es idempotente. Las credenciales quedan **solo** en `BackEnd/.env` (`SEED_*`).
- **`db:migrate`** aplica lo pendiente en los dos schemas (o en uno: `npm run db:migrate -w @sdgpd/backend -- sdgpd_test`). Si una migración ya aplicada cambió, o si una migración nombra un schema, falla.
- **Una migración nueva:** cambiá `src/db/schema/`, corré `npm run db:generate -w @sdgpd/backend`, **revisá el SQL línea por línea** y sacale el prefijo `"public".` a las FK. Si la migración es de RLS o de otra cosa que drizzle-kit no genera, usá `npx drizzle-kit generate --custom --name <nombre>` desde `BackEnd/`. `drizzle-kit push` está prohibido.

## 4. Comprobar a mano

```
npm run db:sql -w @sdgpd/backend -- app_test "select current_user, current_schema()"
```

`db:sql` acepta `migrator`, `app` o `app_test`. Con `--tenant <uuid>` corre todo en una transacción con ese tenant y al final hace rollback, salvo que agregues `--commit`.
