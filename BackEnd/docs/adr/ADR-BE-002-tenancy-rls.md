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

## Objeciones

1. **Caja SUCURSAL contradice el texto vigente del protocolo**, que pone caja en EMPRESA (`FrontEnd/docs/PROTOCOLO.md:17`). Se resuelve en esta misma sesión, porque §1 del protocolo está dentro del alcance. Lo dejo anotado para que conste que el cambio es deliberado.

   **Resolución (2026-10-08):** **confirmado.** Caja es de alcance SUCURSAL y el cambio es deliberado: una caja física es de un lugar y el arqueo se hace por caja (ADR-BE-010). El texto del protocolo ya quedó reescrito en la sesión del 2026-10-07 (`PROTOCOLO.md` §1).
2. **"Reposición" figura como SUCURSAL, pero hoy su estado "solicitado" vive solo en el navegador** (`FrontEnd/src/modules/inventory/state/useReplenishmentStore.ts:29-49`, hallazgo A19). El alcance queda decidido, pero no hay entidad persistida a la cual aplicárselo hasta que una tanda la cree.

   **Resolución (2026-10-08):** la entidad la crea la **sub-decisión 5 de ADR-BE-009** (`replenishment_requests`, de alcance sucursal, con estado `requested` y el usuario que la pidió), aprobada el 2026-10-08. El alcance SUCURSAL de este ADR ya tiene a qué aplicarse, y se materializa en BE-4.

3. **El alcance EMPRESA gana "listas de precios"** (resolución de la objeción 1 de ADR-BE-006, 2026-10-08), pero la enumeración de alcances de `FrontEnd/docs/PROTOCOLO.md` §1 **no** la incluye: §1 del protocolo está fuera del alcance de la sesión de cierre, que solo puede tocar la regla 2.2, la línea de D8 y la trampa 6.6. La tabla de este ADR es la fuente de verdad hasta que una sesión con §1 en alcance lo sincronice. **Objeción nueva, sin resolver.**

   **Resolución (2026-10-08, sesión BE-0a, Paso 0):** `PROTOCOLO.md` §1 ya incluye "listas de precios" en el alcance EMPRESA. Protocolo y tabla de este ADR quedan sincronizados.
