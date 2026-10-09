# VERIFICACIÓN BE-1a — checklist manual

**Fecha:** 2026-10-09. Lo corre Leandro, en **Git Bash**, desde la raíz del repo (`C:\proyectos\SDGPD`), con Node 24 y `BackEnd/.env` armado según `BackEnd/docs/SETUP_SUPABASE.md`. BE-1a no toca el frontend, así que no hay pasos de navegador: la conexión es BE-1b.

> **Actualizado en BE-1b (2026-10-09):** el backend sirve todo bajo el prefijo global `/api` (la variable `B` ya lo incluye) y la cookie de refresh va con `Path=/api/auth/refresh`. En la sección 5, el mensaje de arranque nombra la ruta con el prefijo: `GET /api/users (UsersController.list) no declara permiso`.

**Gate 5 (ADR-BE-001):** todos los endpoints nuevos tienen su schema en `packages/contracts` (`auth.ts`, `users.ts`, `branches.ts`). Su consumidor del frontend llega en **BE-1b** (login, logout, guard de rutas, `useSessionStore` contra `/auth/session`, `TabUsersRoles` contra `/users` y `/roles`; plan en `BackEnd/docs/README.md`). Hasta entonces, su consumidor es este checklist.

**Secretos:** ningún paso imprime contraseñas, tokens ni la clave JWT. Los valores salen de `BackEnd/.env` con `grep`; no los pegues en ningún lado.

## 0. Preparación

| # | Paso | Resultado esperado |
|---|---|---|
| 0.1 | `npm ci` | termina sin errores (puede avisar `allow-scripts` por `esbuild`: es esperado) |
| 0.2 | `grep -c '^JWT_SECRET=' BackEnd/.env` | `1`. Si da `0`: `npm run db:setup -w @sdgpd/backend -- --secrets-only` y repetí |
| 0.3 | `npm run db:migrate -w @sdgpd/backend` | `sdgpd: sin migraciones pendientes (7 en total)` y lo mismo para `sdgpd_test` |
| 0.4 | `npm run db:seed-dev -w @sdgpd/backend` | dos líneas `ok`: `Distribuidora La Proveedora S.A.: 4 sucursales, 4 roles, admin con email en SEED_ADMIN_EMAIL…` y `Empresa B (aislamiento): 1 sucursales, 4 roles…`. Corrélo dos veces: la segunda dice lo mismo (idempotente) |
| 0.5 | `npm run typecheck && npm run lint && npm test && npm run build` | todo en verde. Los tests tardan unos 10 minutos (base remota) |
| 0.6 | En una terminal aparte: `npm run start -w @sdgpd/backend` | en el log, `Mapped {/api/auth/login, POST}`, `{/api/users, GET}`, `{/api/roles/:id/permissions, PUT}`, `{/api/branches, GET}` y `Nest application successfully started` |

Variables para el resto (en la terminal de las pruebas):

```bash
P=$(grep '^PORT=' BackEnd/.env | cut -d= -f2); B="http://localhost:$P/api"   # desde BE-1b todas las rutas llevan el prefijo /api
EA=$(grep '^SEED_ADMIN_EMAIL=' BackEnd/.env | cut -d= -f2);   PA=$(grep '^SEED_ADMIN_PASSWORD=' BackEnd/.env | cut -d= -f2)
EB=$(grep '^SEED_ADMIN_B_EMAIL=' BackEnd/.env | cut -d= -f2); PB=$(grep '^SEED_ADMIN_B_PASSWORD=' BackEnd/.env | cut -d= -f2)
login() { curl -s -c "$3" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\",\"clientType\":\"web\"}" "$B/auth/login"; }
token() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))"; }
```

## 1. Login

| # | Paso | Resultado esperado |
|---|---|---|
| 1.1 | `curl -i -H 'Content-Type: application/json' -d "{\"email\":\"$EA\",\"password\":\"$PA\",\"clientType\":\"web\"}" $B/auth/login \| grep -iE '^HTTP\|^set-cookie' \| sed 's/sdgpd_refresh=[^;]*/sdgpd_refresh=<token>/'` | `HTTP/1.1 200 OK` y `Set-Cookie: sdgpd_refresh=<token>; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` |
| 1.2 | `login "$EA" "$PA" /tmp/a.jar \| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(o.tokenType,o.session.company.name,o.session.role.name,o.session.permissions.length,o.session.branches.map(b=>b.code+':'+b.status).join(','))})"` | `Bearer Distribuidora La Proveedora S.A. Admin 70 CTR:active,NOR:active,SUR:active,VMA:inactive`. El body **no** tiene el refresh token |
| 1.3 | `curl -s -H 'Content-Type: application/json' -d "{\"email\":\"$EA\",\"password\":\"mal-mal-mal\",\"clientType\":\"web\"}" $B/auth/login` | `{"code":"invalid-credentials","message":"Email o contraseña incorrectos"}` (401) |
| 1.4 | Lo mismo con `"email":"nadie@sdgpd.local"` y la contraseña que quieras | **exactamente** el mismo body y el mismo 401 |
| 1.5 | `curl -s -o /dev/null -w '%{http_code}\n' -H 'Content-Type: application/json' -d "{\"email\":\"$EA\",\"password\":\"$PA\",\"clientType\":\"native\"}" $B/auth/login` | `501` (la rama nativa está en el contrato y todavía no se implementa) |
| 1.6 | Bloqueo, **con la empresa B** (no te bloquees el admin A): 5 veces el 1.3 con `$EB`, y después el login correcto `login "$EB" "$PB" /tmp/b.jar` | los 5 intentos y el login correcto dan el mismo 401 `invalid-credentials`. Para desbloquearlo sin esperar 15 minutos: `npm run db:sql -w @sdgpd/backend -- app --tenant $(grep '^SEED_EMPRESA_B_ID=' BackEnd/.env \| cut -d= -f2) --commit "delete from login_attempts"`; después el login correcto da 200 |

## 2. Sesión, permisos y gestión

```bash
TA=$(login "$EA" "$PA" /tmp/a.jar | token)
TB=$(login "$EB" "$PB" /tmp/b.jar | token)
```

| # | Paso | Resultado esperado |
|---|---|---|
| 2.1 | `curl -s -H "Authorization: Bearer $TA" $B/auth/session` | usuario, empresa, rol `Admin`, 70 permisos y las 4 sucursales. Sin `empresaId`, sin hash, sin tokens |
| 2.2 | `curl -s -i $B/auth/session \| head -1` | `401` |
| 2.3 | `curl -s -H "Authorization: Bearer $TA" $B/users` | `{"items":[…],"total":1,"page":1,"pageSize":20}`; el item tiene `id,email,fullName,roleId,active,version,createdAt,branchIds` y **no** `passwordHash` |
| 2.4 | `curl -s -H "Authorization: Bearer $TA" $B/roles` | 4 roles: `Admin` (70), `Chofer` (2), `Deposito` (10), `Vendedor` (9) permisos |
| 2.5 | `curl -s -H "Authorization: Bearer $TA" $B/branches` | las 4 sucursales: `CTR`, `NOR`, `SUR`, `VMA` |
| 2.6 | Alta de un vendedor (copiá el `id` del rol `Vendedor` del 2.4 en `R` y el de `CTR` del 2.5 en `S`): `curl -s -H "Authorization: Bearer $TA" -H "Idempotency-Key: $(node -e "console.log(crypto.randomUUID())")" -H 'Content-Type: application/json' -d "{\"email\":\"vendedor@sdgpd.local\",\"fullName\":\"Vendedor Uno\",\"password\":\"contraseña-del-vendedor\",\"roleId\":\"$R\",\"branchIds\":[\"$S\"]}" $B/users` | `201` con el usuario (`version: 1`, `branchIds: [S]`), sin hash |
| 2.7 | El mismo POST sin `Idempotency-Key` | `400 idempotency-key-required` |
| 2.8 | `TV=$(login vendedor@sdgpd.local contraseña-del-vendedor /tmp/v.jar \| token); curl -s -H "Authorization: Bearer $TV" $B/users` | `403` `{"code":"forbidden",…,"details":{"module":"settings","action":"ver"}}` |
| 2.9 | `curl -s -H "Authorization: Bearer $TV" $B/branches` | solo `CTR` (la habilitada) |
| 2.10 | Darle `settings.ver` al Vendedor: `PUT $B/roles/$R/permissions` con body `{"permissions":[…los 9 del 2.4…, {"module":"settings","action":"ver"}],"version":<la del 2.4>}` y `Authorization: Bearer $TA` | `200`, el rol con `version` + 1 y 10 permisos |
| 2.11 | Repetí el 2.8 con el **mismo** `$TV` | `401`: cambió la matriz y el token viejo dejó de valer |
| 2.12 | `curl -s -b /tmp/v.jar -c /tmp/v.jar -X POST -H 'X-Requested-With: XMLHttpRequest' $B/auth/refresh \| token` y con ese token, el 2.8 | el refresh da un token nuevo y el 2.8 ahora da `200` |

## 3. Refresh y logout

| # | Paso | Resultado esperado |
|---|---|---|
| 3.1 | `curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/a.jar -X POST $B/auth/refresh` (sin `X-Requested-With`) | `403` (`csrf-header-required`) |
| 3.2 | `cp /tmp/a.jar /tmp/a-viejo.jar; curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/a.jar -c /tmp/a.jar -X POST -H 'X-Requested-With: XMLHttpRequest' $B/auth/refresh` | `200`, y `/tmp/a.jar` queda con la cookie rotada |
| 3.3 | Reuso: el mismo comando con `-b /tmp/a-viejo.jar` (el token ya usado) | `401` |
| 3.4 | Después del reuso, el refresh con la cookie **nueva** (`-b /tmp/a.jar`) | `401`: el reuso revocó la familia entera |
| 3.5 | `TA=$(login "$EA" "$PA" /tmp/a.jar \| token); curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TA" $B/auth/logout` | `204` |
| 3.6 | El refresh con `-b /tmp/a.jar` | `401`: el logout revocó la familia |

## 4. Aislamiento entre empresas (a mano)

| # | Paso | Resultado esperado |
|---|---|---|
| 4.1 | `TB=$(login "$EB" "$PB" /tmp/b.jar \| token); curl -s -H "Authorization: Bearer $TB" $B/users` | solo el admin de B (`total: 1`); ningún usuario de A |
| 4.2 | Con `$TB`, `PUT $B/users/<id del vendedor del 2.6>` con un body válido | `404` |
| 4.3 | Con `$TB`, `PUT $B/roles/$R/permissions` (el rol Vendedor de A) | `404` |
| 4.4 | `curl -s -H "Authorization: Bearer $TB" $B/branches` | solo `BCC` |

## 5. La app no arranca con una ruta sin política (V3)

| # | Paso | Resultado esperado |
|---|---|---|
| 5.1 | Cortá el backend. En `BackEnd/src/settings/users.controller.ts`, borrá la línea `@RequirePermission('settings', 'ver')` de `list()`. `npm run build -w @sdgpd/backend && npm run start -w @sdgpd/backend` | no arranca: `Error: Rutas sin política de acceso válida (ADR-BE-003, sub-decisión 6): - GET /api/users (UsersController.list) no declara permiso` |
| 5.2 | `git checkout -- BackEnd/src/settings/users.controller.ts` y volvé a compilar y levantar | arranca normal |

## 6. Limpieza

`rm -f /tmp/a.jar /tmp/a-viejo.jar /tmp/b.jar /tmp/v.jar`. El vendedor del 2.6 queda en `sdgpd` (está auditado, así que no se puede borrar; se puede desactivar con `PUT /users/{id}` y `"active": false`).
