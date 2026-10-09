# ADR-BE-002 — Tenancy y Row-Level Security

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #1 y #18 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md). El detalle de caja de la #18 está en ADR-BE-010.

**Enmienda a ADRs del frontend:** ninguno (reemplaza la regla 3.5 del protocolo y la decisión D1 del log se cumple).

## Contexto

La decisión D1 (`FrontEnd/docs/historial/DECISIONES_TECNICAS_LOG.md:219-220`) dice que el frontend nunca manda la empresa como parámetro manipulable, porque sería "candidato a IDOR". La regla 3.5 del protocolo y el barrido del 2026-09-08 hicieron lo contrario: **87 de 91 llamadas** mandan `empresaId` en query o body (hallazgo **B1**, `04_TRANSVERSALES.md` §2; 01 C-10). Por otro lado, `branchId` viaja en el path en algunos endpoints, en la query en otros, y en 14 endpoints de recursos de sucursal no viaja (hallazgo **M5**, 01 C-8). El alcance empresa/sucursal de compras, caja, vehículos y lotes estaba abierto (08 #18).

## Decisión

1. **La empresa sale siempre de la sesión.** Ningún request lleva `empresaId`: ni en la query, ni en el body, ni en el path. La regla 3.5 del protocolo se reemplaza. **Las query keys del frontend siguen incluyendo `companyId`** (la regla 3.4 no cambia): es una necesidad del caché, no del contrato.
2. **Toda tabla tiene `empresa_id NOT NULL` y RLS forzado** (`ENABLE` + `FORCE ROW LEVEL SECURITY`). El rol con el que se conecta la aplicación **no es dueño de las tablas ni tiene `BYPASSRLS`**. El tenant se fija **por transacción** con `SET LOCAL`, nunca por conexión. Las FK son **compuestas** `(empresa_id, id)`, así que una fila no puede referenciar una fila de otra empresa.
3. **`branchId` sí viaja**, siempre en la query o en el body, **nunca en el path**. El servidor valida que la sucursal pertenezca a la empresa y que el usuario la tenga habilitada.
4. **Alcances:**

| Alcance | Entidades |
|---|---|
| EMPRESA | productos, proveedores, clientes, vehículos, choferes, motivos, usuarios, settings, **listas de precios** (ADR-BE-006, resolución de la objeción 1) |
| EMPRESA, con sucursal obligatoria como atributo | pedido (sucursal de origen), orden de compra (sucursal destino) |
| SUCURSAL | stock, lotes, movimientos, reposición, entregas, viajes, caja |

Ilustración (no es una migración):

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON orders
  USING      (empresa_id = current_setting('app.empresa_id', true)::uuid)
  WITH CHECK (empresa_id = current_setting('app.empresa_id', true)::uuid);
ALTER TABLE orders ADD CONSTRAINT orders_empresa_id_uk UNIQUE (empresa_id, id);
ALTER TABLE orders ADD CONSTRAINT orders_client_fk
  FOREIGN KEY (empresa_id, client_id) REFERENCES client_accounts (empresa_id, id);
-- por request, dentro de la transaccion:
SELECT set_config('app.empresa_id', $1, true);   -- equivale a SET LOCAL
```

## Alternativas descartadas (08 #1)

- **B. Mandar `empresaId` en el request y validarlo contra la sesión:** duplica la fuente de verdad, y basta con que un endpoint olvide el chequeo para que haya fuga entre tenants. D1 lo describe como el riesgo.
- **C. `empresaId` en el path (`/empresas/{id}/…`):** las mismas desventajas que B, con la URL más explícita.
- **Tenant por conexión (`SET` sin `LOCAL`):** con un pool de conexiones, el valor queda pegado a la conexión y "viaja" al próximo request que la reutilice.

## Consecuencias para el backend

- Hay un middleware o interceptor que abre la transacción del request, ejecuta `set_config('app.empresa_id', …, true)` con la empresa del token (ADR-BE-003) y recién después ejecuta el comando o la consulta. Sin empresa en la sesión, no hay transacción.
- Fail-closed: `current_setting('app.empresa_id', true)` sin valor devuelve `NULL`, la política no matchea ninguna fila y la consulta no devuelve nada.
- La suite de aislamiento (ADR-BE-001, gate 4) crea dos empresas y verifica, **por cada tabla**, que con el tenant A no se lee, no se actualiza y no se inserta nada de B, ni con una FK que apunte a B.
- Validación de sucursal en cada request que trae `branchId`: la FK compuesta garantiza que pertenece a la empresa, y la tabla de sucursales habilitadas por usuario (ADR-BE-003) garantiza que el usuario puede operar en ella. En los recursos de sucursal accedidos por id (viaje, entrega), la sucursal se lee de la fila y se valida igual.

## Consecuencias para el frontend

- Al conectar cada módulo, sus funciones de service **dejan de recibir y de mandar `empresaId`**. Los hooks lo siguen leyendo de la sesión **solo para la query key** (`cachedQueryKey`, `usePagedQuery`).
- `getStockedProductsPage` (`/products/stock-by-branch/{branchId}`) y `getStockForBranch` (`/products/{id}/stock/{branchId}`) pasan `branchId` a la query.
- Caja pasa a ser de sucursal: `CashPage` empieza a mandar `branchId`, y la query key lo incluye (regla 3.4).
- `Trip.empresaId` (`trip.types.ts:92`) sale del tipo de dominio.

## Hallazgos que cierra

- **B1** (tenant en el request, contra D1).
- **M5** (`branchId` en el path, en la query o en ninguno).

## Sub-decisiones (aprobadas 2026-10-08)

1. **La tabla `companies` (`Company`, `session.types.ts:24`) es la única sin `empresa_id`:** su `id` es el tenant, y su política es `id = current_setting('app.empresa_id', true)::uuid`.
2. **Login antes de conocer el tenant:** el usuario se busca por email con una función `SECURITY DEFINER` (`auth_find_user(email)`) que devuelve solo id, empresa y hash, y que es lo único que puede leer `users` sin tenant. El email es único **global** (ADR-BE-003: un usuario pertenece a una sola empresa).
3. **Nombre de la variable de sesión:** `app.empresa_id`. Para la sucursal no se usa una variable de sesión: la valida la aplicación, porque una misma transacción puede tocar varias sucursales (por ejemplo, un despacho desde otra sucursal).
4. **Alertas y auditoría:** alcance EMPRESA, con `sucursal_id` opcional como atributo (no estaban en la lista de alcances).
5. **Ningún DTO de respuesta expone `empresaId`:** es redundante con la sesión.
6. **Rol de migraciones separado del rol de la aplicación:** el de migraciones es dueño de las tablas; el de la aplicación solo tiene `SELECT/INSERT/UPDATE/DELETE` sobre ellas.
7. **Transición de la regla 3.5 en el frontend:** mientras un módulo siga sobre el adaptador mock, sus funciones de service pueden conservar el parámetro `empresaId` (el mock no lo usa). Se elimina de la firma y del request al conectar el módulo. Escrito así en la nueva regla 3.5 del protocolo.

### Sub-decisiones de la tanda BE-0a (2026-10-08, tomadas al implementar; ver `FrontEnd/docs/historial/reportes/REPORTE_2026-10-08.md`)

8. **El schema lo decide el rol, no el código.** `scripts/db/setup.ts` fija `ALTER ROLE sdgpd_app SET search_path TO sdgpd` y `ALTER ROLE sdgpd_app_test SET search_path TO sdgpd_test`. La aplicación no nombra ningún schema: con la URL de `sdgpd_app` trabaja en `sdgpd`, y con la de `sdgpd_app_test`, en `sdgpd_test`. El migrador tiene `search_path = pg_catalog`, así que una sentencia sin schema que se le escape falla en vez de caer en otro lado.
9. **UUID v7 generados por la aplicación** (`uuid` v7, `src/db/ids.ts`): el Postgres del proyecto es **17.11** y `uuidv7()` nativo llega en la 18. Las columnas `id` son `uuid` **sin default**: una fila sin id explícito falla. Si el proyecto pasa a Postgres 18, se puede revisar.
10. **Expresión de la política:** `<columna> = nullif(current_setting('app.empresa_id', true), '')::uuid`. Sin `nullif`, una conexión que ya fijó el tenant en una transacción anterior devuelve `''` (no `NULL`) y el cast a `uuid` falla con un error en vez de devolver cero filas. Con `nullif`, los dos casos dan `NULL`, no matchea nada y es fail-closed (verificado en la suite: "el tenant es local a la transacción").
11. **Runner de migraciones propio** (`scripts/db/migrate.ts`) sobre los archivos de `drizzle-kit generate` (journal + SQL), en vez del `migrate()` de `drizzle-orm`. Ese `migrate()` corre `CREATE SCHEMA IF NOT EXISTS` (pide `CREATE` sobre la base, que el migrador no tiene) y no deja controlar los privilegios de su tabla de control. El runner:
    - aplica cada schema en **una transacción**, con `SET LOCAL search_path` y un lock exclusivo sobre la tabla de control;
    - registra cada migración en `<schema>.schema_migrations` (tag + SHA-256 del archivo normalizado a LF), que crea `setup.ts` sin ningún privilegio para los roles de aplicación;
    - falla si una migración ya aplicada cambió, o si hay una aplicada que no está en el repo;
    - **rechaza toda migración que nombre `public`, un schema o rol `sdgpd*`, o que cambie `search_path` o el rol**.

    `drizzle-kit generate` califica las FK con `"public"`: **ese prefijo se saca a mano** al revisar la migración (ADR-BE-001, consecuencias: "generado o escrito a mano, y revisado"). Si alguien lo olvida, el runner no la aplica.
12. **Privilegios y contraseñas de los roles:**
    - Los privilegios de los roles de aplicación salen de `ALTER DEFAULT PRIVILEGES FOR ROLE sdgpd_migrator IN SCHEMA <su schema>` (`SELECT, INSERT, UPDATE, DELETE`), así que toda tabla nueva queda alcanzable sin tocar la migración. Las funciones nuevas nacen sin `EXECUTE` para `PUBLIC`.
    - Los schemas se revocan para `PUBLIC`, `anon` y `authenticated`, y **también para `service_role`**, que en Supabase tiene `BYPASSRLS`.
    - Los tres roles son `NOINHERIT`, sin `CREATEDB` ni `CREATEROLE`. Las contraseñas se generan en el setup (32 bytes aleatorios) y se guardan solo en `BackEnd/.env`. **Al servidor viaja el verificador SCRAM-SHA-256, nunca la contraseña en claro**, así que no queda en ningún log de sentencias. Volver a correr el setup reusa las contraseñas de `.env` y, **si ya conectan, no vuelve a mandar el verificador**. Cada envío lleva una sal nueva, y el pooler de Supabase cachea el verificador anterior: re-enviarlo dejaba los tres roles con `28P01` hasta que el pooler refrescara su caché (pasó en esta sesión y se corrigió).
13. **`withTenant` como única vía:** `Database` expone solo `withTenant` y `ping()` (`select 1`, sin tablas). El cliente Drizzle es privado, y ESLint prohíbe importar `pg` o `drizzle-orm/node-postgres` fuera de `src/db/`. `withTenant` valida que `empresaId` sea UUID antes de abrir la transacción.
14. **Suite de aislamiento, en dos partes.** La de **catálogo** enumera las tablas desde `pg_catalog` y cubre sola cualquier tabla futura. La **funcional** tiene un caso por tabla (`ISOLATION_CASES`), y su primer test compara la lista de casos con las tablas con RLS del catálogo: **una tabla nueva sin caso de aislamiento hace fallar la suite** (ADR-BE-001, gate 4). Como el rol de aplicación no es dueño, quitar `FORCE` no cambia lo que ve: eso lo detecta la parte de catálogo (V1).
15. **`companies` y `branches` de BE-0a:** `companies(id, name, timezone, created_at)` y `branches(id, empresa_id, name, code, city, address, status, created_at)`, con los nombres del tipo `Branch` del frontend. `status` es `active | inactive` (CHECK), y hay `UNIQUE (empresa_id, id)` y `UNIQUE (empresa_id, code)`. **`timezone` no se valida contra la base IANA en Postgres**: lo valida el contrato del recurso en BE-1. `version` y auditoría llegan en BE-0b.

### Sub-decisiones de la tanda BE-1a (2026-10-09, tomadas al implementar sin consulta, PROTOCOLO regla 2.9)

16. **Las dos funciones `SECURITY DEFINER`** (sub-decisión 2), en la migración `0005_rls_identity.sql`, `LANGUAGE sql STABLE`:
    - `auth_find_user(email)` → `id, empresa_id, password_hash, active`, por email normalizado;
    - `auth_find_refresh_token(token_hash)` → `id, empresa_id, user_id, family_id`, por hash. Nunca devuelve el hash, y el estado del token (usado, revocado, vencido) se lee y se escribe después, con el tenant ya fijado.

    El dueño es `sdgpd_migrator`, que las crea. Como una migración no puede nombrar schemas ni roles (sub-decisión 11), el `search_path` fijo (`<schema>, pg_temp`: `pg_temp` al final, para que una tabla temporal no suplante a una real) y el `EXECUTE` (solo el rol de aplicación de ese schema; nunca `PUBLIC`) los aplican `scripts/db` (`hardenDefinerFunctions`), en la misma transacción que las migraciones.
17. **`FORCE ROW LEVEL SECURITY` alcanza también al dueño**, así que la función, que corre como el migrador, vería cero filas. Por eso `users` y `refresh_tokens` tienen una segunda política, `definer_lookup`: `FOR SELECT TO CURRENT_USER USING (true)`, donde `CURRENT_USER` es el migrador que corre la migración. No le da al migrador nada que no tenga ya, porque como dueño puede alterar la tabla. Los roles de aplicación no la tienen: sin tenant siguen viendo cero filas (probado en `test/db/definer.test.ts`).
18. **Las únicas lecturas sin tenant de la aplicación** son `Database.findLoginUser` y `Database.findRefreshToken`, que llaman a esas funciones y validan con un schema estricto que devuelvan exactamente sus columnas. Todo lo demás de la autenticación (intentos, rotación, revocación, carga del usuario en el guard) corre con el tenant de la fila encontrada o del token (`AuthStore`).
19. **FK compuestas en las tablas de identidad**, y FK `(empresa_id, user_id) → users` en `idempotency_keys` y `audit_log`, pendiente de BE-0b. Estas dos van **`NOT VALID`**: las filas que ya existían (de los tests de BE-0b, con usuarios inventados) no se validan, y toda fila nueva sí. `audit_log` no se puede corregir (es append-only). Consecuencia: **un usuario auditado no se puede borrar, solo desactivar**, y en `sdgpd_test` quedan, con ids y emails aleatorios, las empresas de prueba cuyos usuarios quedaron auditados.
20. **`branchId` lo valida el guard**, en la query o en el body (nunca en el path), contra las sucursales habilitadas del usuario (`user_branches`), que lee en cada request. Una sucursal de otra empresa no puede estar habilitada (FK compuesta), así que también da 403. No hay excepción para el rol Admin: el admin del seed tiene todas habilitadas.
21. **`login_attempts` lleva `empresa_id`**, como toda tabla (sub-decisión 14, catálogo): es una fila por usuario, no por email. Un email inexistente no deja fila, y el bloqueo responde igual que cualquier fallo (ADR-BE-003, sub-decisión 12), así que no hace falta una tabla sin tenant.

## Objeciones

1. **Caja SUCURSAL contradice el texto vigente del protocolo**, que pone caja en EMPRESA (`FrontEnd/docs/PROTOCOLO.md:17`). Se resuelve en esta misma sesión, porque §1 del protocolo está dentro del alcance. Lo dejo anotado para que conste que el cambio es deliberado.

   **Resolución (2026-10-08):** **confirmado.** Caja es de alcance SUCURSAL y el cambio es deliberado: una caja física es de un lugar y el arqueo se hace por caja (ADR-BE-010). El texto del protocolo ya quedó reescrito en la sesión del 2026-10-07 (`PROTOCOLO.md` §1).
2. **"Reposición" figura como SUCURSAL, pero hoy su estado "solicitado" vive solo en el navegador** (`FrontEnd/src/modules/inventory/state/useReplenishmentStore.ts:29-49`, hallazgo A19). El alcance queda decidido, pero no hay entidad persistida a la cual aplicárselo hasta que una tanda la cree.

   **Resolución (2026-10-08):** la entidad la crea la **sub-decisión 5 de ADR-BE-009** (`replenishment_requests`, de alcance sucursal, con estado `requested` y el usuario que la pidió), aprobada el 2026-10-08. El alcance SUCURSAL de este ADR ya tiene a qué aplicarse, y se materializa en BE-4.

3. **El alcance EMPRESA gana "listas de precios"** (resolución de la objeción 1 de ADR-BE-006, 2026-10-08), pero la enumeración de alcances de `FrontEnd/docs/PROTOCOLO.md` §1 **no** la incluye: §1 del protocolo está fuera del alcance de la sesión de cierre, que solo puede tocar la regla 2.2, la línea de D8 y la trampa 6.6. La tabla de este ADR es la fuente de verdad hasta que una sesión con §1 en alcance lo sincronice. **Objeción nueva, sin resolver.**

   **Resolución (2026-10-08, sesión BE-0a, Paso 0):** `PROTOCOLO.md` §1 ya incluye "listas de precios" en el alcance EMPRESA. Protocolo y tabla de este ADR quedan sincronizados.
