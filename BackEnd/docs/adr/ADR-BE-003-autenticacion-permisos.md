# ADR-BE-003 — Autenticación, identidad y permisos

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisión #2 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** ninguno.

## Contexto

Hoy no hay autenticación:
- La sesión es un mock (`FrontEnd/src/services/mock/session.service.ts:17-20`), sin `httpClient` y sin credenciales.
- `SessionUser` no tiene rol ni permisos (`session.types.ts:29-36`).
- `httpClient` en modo `http` no manda `Authorization` ni `credentials` (`httpClient.ts:161-195`).
- Ocho mutaciones toman el actor del body (`quien`, `creadoPor`, `responsable`; 01 C-11).
- Hay dos modelos de usuario desconectados (`SessionUser` contra `UserAccount`, `settings.types.ts:7`) y `Driver` sin usuario (hallazgo **M11**).
- La matriz de permisos no la consulta nadie, tiene 8 de 10 módulos y convive con un `USER_ROLE='ADMIN'` fijo (`InventoryPage.tsx:69`; hallazgos **A17**, **M12**).

Hallazgo **B2** (`00_RESUMEN.md`; `04_TRANSVERSALES.md` §1 y §3).

## Decisión

1. **Access token corto** (Bearer, guardado en memoria del cliente) más **refresh token rotativo**. **Contraseñas con argon2id.** El transporte del refresh depende del **tipo de cliente, que el login declara** (resolución de la objeción 1):
   - **Web:** cookie `HttpOnly`, `Secure` y `SameSite`.
   - **App nativa:** el refresh viaja en el **body** de la respuesta del login y en el body del request de `POST /auth/refresh`.
   - En los dos casos rigen la **misma rotación** y la **misma detección de reuso** (sub-decisión 3). El contrato lo prevé desde ahora; la rama nativa se implementa cuando exista la app.
2. **Un solo usuario:** `SessionUser` y `UserAccount` pasan a ser proyecciones de la misma tabla. **Un usuario pertenece a una sola empresa.**
3. **La sesión devuelve** usuario, empresa, rol, permisos efectivos y sucursales habilitadas.
4. **Roles por empresa y matriz de permisos módulo × acción**, aplicada **en el servidor en cada endpoint**. La UI la usa solo para ocultar. **La matriz incluye compras y settings.**
5. **`Driver` sigue siendo una entidad propia**, con `usuarioId` opcional y nulo desde el día uno.
6. **El actor sale siempre de la sesión:** las 8 mutaciones que hoy mandan `quien`, `creadoPor` o `responsable` dejan de hacerlo.

## Alternativas descartadas (08 #2)

- **Cookie de sesión stateful sola, sin access token:** sirve para la web pero no para la app del chofer, y obliga a protegerse de CSRF en cada mutación.
- **Bearer de larga duración sin refresh:** si se roba, vale hasta que expira, y no hay rotación ni revocación práctica.
- **Mantener dos modelos de usuario:** es el estado actual (M11). El rol no llega a la sesión y el actor no tiene identidad.
- **`Driver` como usuario obligatorio:** el ABM de choferes existe desde la Tanda 10B sin usuarios (`driver.types.ts:8-14`). Obligarlo bloquearía cargar choferes que todavía no usan la app.

## Consecuencias para el backend

- Endpoints de auth (sub-decisión 1): `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/session`. **`/auth/*` está exento de la idempotencia obligatoria en POST** de ADR-BE-005 (resolución de su objeción 1): login y logout se pueden repetir sin efecto, y refresh ya tiene rotación y detección de reuso.
- `POST /auth/login` recibe el **tipo de cliente** (`web|native`) y decide dónde devuelve el refresh: cookie o body (decisión 1). El resto del flujo es idéntico.
- Un guard global valida el access token, carga usuario, empresa, rol y permisos, y fija el tenant (ADR-BE-002). Un decorador por endpoint declara el permiso que exige (módulo + acción). **Un endpoint sin permiso declarado no compila el registro de rutas** (sub-decisión 6).
- Los DTO de request **no tienen** campos de actor. `quien`, `creadoPor` y `responsable` (y `CapacityOverrideEvent.quien`, `Pod.creadoPor`, `DeliveryNote.creadoPor`) los llena el servidor desde la sesión, como id de usuario, más un snapshot del nombre para mostrar.
- Tabla de sucursales habilitadas por usuario, que usa la validación de `branchId` de ADR-BE-002.

## Consecuencias para el frontend

- `httpClient` agrega `Authorization: Bearer <token>`, usa `credentials: 'include'` solo en `/auth/refresh`, y ante un 401 intenta un refresh y reintenta el request una sola vez.
- Aparecen login, logout y guard de rutas. Hoy no existen (`AUDIT_2026-09-30_iam.md`).
- `useSessionStore.loadSession` deja `fetchSession` y pasa a `GET /auth/session`. `SessionUser` gana rol, permisos y sucursales habilitadas. El selector de sucursal ofrece solo las habilitadas.
- `USER_ROLE` (`InventoryPage.tsx:69`) desaparece: los botones se ocultan según los permisos de la sesión.
- `TabUsersRoles` pasa de una matriz de 8 booleanos por módulo (`settings.types.ts:15-27`) a una matriz módulo × acción con 10 módulos.
- Los modales que hoy mandan el actor (`RegistrarEntregaModal`, `ReprogramarModal`, `PodModal`, `TripDetailPanel`, `LogisticsPage`, `CreateTripModal`, `CreateDeliveryModal`) dejan de leer `session.fullName` para mandarlo.

## Hallazgos que cierra

- **B2** (no hay auth; el actor viaja en el body).
- **A17** (permisos sin enforcement; `USER_ROLE` fijo).
- **M11** (dos modelos de usuario; `Driver` sin usuario).
- **M12** (la matriz no tiene compras ni settings).

## Sub-decisiones (aprobadas 2026-10-08)

1. **Paths de auth:** `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/session` (sustantivo `auth` más acción, siguiendo la convención de acciones de ADR-BE-004).
2. **Access token:** JWT firmado, con duración de **15 minutos**. Claims: `sub` (usuario), `emp` (empresa), `rol`, `ver` (versión de permisos, para invalidar tokens cuando cambian los permisos).
3. **Refresh token:** opaco, **30 días**. Se guarda hasheado en la base, con rotación en cada uso y **detección de reuso** (si se presenta un refresh ya usado, se revoca toda la familia). Cookie con `Path=/auth/refresh` y `SameSite=Strict`.
4. **CSRF de `/auth/refresh`:** exige el header `X-Requested-With`. Como el único endpoint con cookie no ejecuta comandos de negocio, no hace falta token CSRF.
5. **Un rol por usuario**, no varios. Los 4 `SystemRole` actuales (`Admin`, `Vendedor`, `Chofer`, `Deposito`) se siembran como roles iniciales de cada empresa, y la empresa puede editarlos.
6. **Acciones de la matriz:** `ver`, `crear`, `editar`, `anular`, `aprobar`, `exportar`, `forzar` (este último, para el override de capacidad de ADR-011). Módulos: los 10 de `FrontEnd/src/modules/`.
7. **Email único global**, consecuencia de "un usuario pertenece a una sola empresa", necesaria para el login sin tenant (ADR-BE-002, sub-decisión 2).
8. **Parámetros de argon2id:** los valores recomendados por OWASP vigentes al implementar, con los parámetros guardados junto al hash para poder subirlos después sin romper hashes viejos.

### Sub-decisiones de la tanda BE-1a (2026-10-09, tomadas al implementar sin consulta, PROTOCOLO regla 2.9; ver `FrontEnd/docs/historial/reportes/REPORTE_2026-10-09_be1a.md`)

9. **Firma del access token:** JWT **HS256** con una clave de 32 bytes aleatorios (`JWT_SECRET`), que genera `db:setup` y vive solo en `BackEnd/.env`. Sin la clave, o con menos de 32 bytes, el backend no arranca. La verificación fija el algoritmo (`alg: none` y cualquier otro se rechazan), el emisor (`sdgpd`) y la audiencia (`sdgpd-api`), y exige `exp`, `iat` y `sub`. HS256 alcanza mientras un solo servicio emita y verifique; si aparece otro verificador, se pasa a una clave asimétrica.
10. **Claim `sid`, además de los cuatro de la sub-decisión 2:** el id de la familia de refresh del login. Lo usa el logout (sub-decisión 11) y no es un secreto (es un id, no el token).
11. **Logout:** la cookie tiene `Path=/auth/refresh` (sub-decisión 3), así que el navegador **no la manda** a `/auth/logout`. `POST /auth/logout` revoca la familia de la cookie si llega, y si no, la del `sid` de un access token válido (`Authorization: Bearer`). Siempre borra la cookie y responde 204; sin cookie ni token válido no hace nada más (se puede repetir sin efecto). Si el access token venció, el cliente refresca antes de salir.
12. **Bloqueo por intentos fallidos:** 5 contraseñas incorrectas dentro de 15 minutos bloquean el login de ese usuario 15 minutos (`login_attempts`, una fila por usuario). Mientras dura, ni la contraseña correcta entra. **El bloqueo responde lo mismo que cualquier otro fallo** (401 `invalid-credentials`, mismo mensaje), así que no revela qué emails existen. Un email inexistente no deja fila (no hay cuenta que proteger) y nunca responde distinto. Solo una contraseña incorrecta suma un fallo; un login exitoso los borra.
13. **Tiempo de respuesta del login:** con un email inexistente se verifica la contraseña contra un hash de relleno con los mismos parámetros, para que tarde lo mismo que con un email real. Queda una diferencia de una o dos consultas a la base (ver el reporte, riesgos).
14. **Refresh token:** 32 bytes aleatorios en base64url; en la base, solo su SHA-256 en hex. Cada token vale 30 días **desde que se emite**: cada rotación emite uno nuevo con 30 días (vida deslizante, sin tope absoluto para la familia). Un token ya usado revoca la familia entera, incluido el último emitido; un usuario inactivo al refrescar, también. Un 401 del refresh borra la cookie. La cookie se llama `sdgpd_refresh`. `X-Requested-With` vale con cualquier valor no vacío; sin él, 403 `csrf-header-required` y el token no se consume.
15. **El guard carga al usuario en cada request**, con el tenant del token y en una sola consulta: activo, rol, `permissions_version`, permisos y sucursales habilitadas. Un usuario de otra empresa (un `emp` que no es el suyo) no aparece, por RLS. Cualquier falla del token es 401 `unauthenticated`; sin el permiso, 403 `forbidden` con `details.module` y `details.action`.
16. **Tres políticas de ruta, y cada ruta declara una:** `@RequirePermission(módulo, acción)`, `@SessionOnly()` (con sesión y sin permiso de módulo) y `@Public()`. Las dos últimas solo valen en sus listas (`PUBLIC_ROUTES`: `/health` y `POST /auth/login|refresh|logout`; `SESSION_ROUTES`: `GET /auth/session` y `GET /branches`). La verificación de arranque (`RoutePolicyCheck`) recorre todas las rutas registradas y hace fallar el arranque si alguna no declara política o usa una fuera de su lista. Así se cumple la sub-decisión 6 ("no compila el registro de rutas") en tiempo de arranque, no de compilación.
17. **Permisos de los endpoints de gestión (módulo `settings`):** `GET /users` y `GET /roles`, `ver`; `POST /users`, `crear`; `PUT /users/{id}` y `PUT /roles/{id}/permissions`, `editar`. `GET /branches` es de sesión: con `settings.ver` lista todas las sucursales de la empresa (para asignarlas); sin él, solo las habilitadas.
18. **Qué invalida los access tokens:** cambiar el rol de un usuario sube su `permissions_version`, y cambiar la matriz de un rol sube la de todos los usuarios del rol. El guard compara `ver` en cada request, así que el token viejo deja de valer en el próximo request, y el refresh emite uno con los permisos nuevos. La subida va por el `update` versionado de `CommandTx`, que también sube la `version` del usuario: un formulario de usuario abierto mientras cambia la matriz de su rol da 409 (aceptado: los permisos de ese usuario cambiaron). Las sucursales habilitadas no suben la versión, porque el guard las lee en cada request.
19. **Alta y edición de usuarios:** la contraseña inicial tiene entre 12 y 256 caracteres. El email no se edita. Un email repetido es 409 `email-in-use`, también si es de otra empresa: es inevitable con el email único global, y solo lo ve quien tiene `settings.crear`. Rol o sucursal inexistentes en la empresa: 422 `role-not-found` / `branch-not-found`. Desactivar a un usuario revoca sus refresh tokens en la misma transacción.
20. **Matrices iniciales de los 4 roles** (`src/auth/default-roles.ts`): Admin, toda la matriz (70 permisos). Vendedor: `dashboard.ver`; `orders` ver, crear, editar, anular; `clients` ver, crear, editar; `inventory.ver`. Chofer: `logistics` ver y editar. Deposito: `dashboard.ver`; `inventory` ver, crear, editar; `logistics` ver, editar; `compras` ver, crear, editar; `suppliers.ver`. Son un punto de partida; la empresa los edita.
21. **argon2id con m=19456 KiB, t=2, p=1** (mínimo de OWASP vigente al 2026-10-09), guardado como cadena PHC, que lleva los parámetros. Si se suben, un hash viejo se sigue verificando; el re-hasheo al login queda pendiente para cuando se suban.
22. **La rama `native` del login responde 501 `not-implemented`** hasta que exista la app (objeción 1). El contrato ya la tiene (`clientType`).
23. **`refresh_tokens` y `login_attempts` no pasan por `audit_log`:** son infraestructura de la sesión, como `idempotency_keys`. Lo que cambia un usuario o un rol sí se audita (con el hash de la contraseña excluido). Para las filas hijas sin `version` (permisos de un rol, sucursales de un usuario), `CommandTx` gana `removeChild`: un borrado auditado cuya concurrencia controla la versión del padre.

### Sub-decisiones de la tanda BE-1b (2026-10-09, tomadas al implementar sin consulta, PROTOCOLO regla 2.9; ver `FrontEnd/docs/historial/reportes/REPORTE_2026-10-09_be1b.md`)

24. **Prefijo global `/api`** en todas las rutas del backend (`configureApp`, `src/http/api-prefix.ts`), y la cookie de refresh con **`Path=/api/auth/refresh`** (reemplaza el `Path=/auth/refresh` de la sub-decisión 3). El navegador ve el mismo path que el backend: en desarrollo, Vite hace proxy de `/api` **sin reescribir la ruta** (resuelve el riesgo del Path de BE-1a, y la objeción 2 sigue resuelta: mismo origen).
25. **Guarda de último admin:** ningún cambio de usuario (rol, activo) ni de matriz puede dejar a la empresa sin al menos un usuario activo con `settings.editar`; si pasaría, **422 `last-admin`** y el comando se revierte entero. Se chequea al final del comando, en su transacción, después de un **advisory lock de transacción por empresa** (`CommandTx.lockScope('identity')`): dos cambios concurrentes que juntos dejarían a la empresa sin admin se serializan, y el segundo ve el efecto del primero (sin write skew; probado con dos admins que se desactivan entre sí a la vez).
26. **Login con tiempo parejo:** con un email inexistente se verifica contra un hash ficticio y se hacen **las mismas dos transacciones de base** que con una contraseña incorrecta (estado del bloqueo y registro), contra un tenant inexistente que RLS deja vacío. Una contraseña incorrecta suma un fallo **también durante el bloqueo**, así que seguir probando lo renueva (antes, durante el bloqueo no se registraba y el camino tenía una transacción menos). Un test compara las medianas de los dos casos (factor 2).
27. **Limpieza de refresh tokens vencidos** en el mismo scheduler que la idempotencia (cada 15 minutos), con su propio advisory lock por schema y la misma técnica: política `expired_cleanup` (`FOR DELETE USING (expires_at <= now())`, migración 0006) y un `DELETE` sin `WHERE` ni `RETURNING` sin tenant. Un token vencido no sirve ni para refrescar ni para detectar un reuso, así que borrarlo no pierde nada.
28. **Frontend (BE-1b):**
    - el access token vive **solo en memoria** (`shared/auth/tokenStore.ts`); al recargar la página se recupera con un refresh;
    - **single-flight**: todos los 401 que llegan mientras hay un refresh en vuelo esperan ese mismo, y cada request se reintenta **una sola vez**; si el refresh falla, el token se borra y la sesión se cierra (al login), sin reintentar el refresh;
    - el refresh y el login van con `credentials: 'include'`; el refresh, además, con `X-Requested-With: XMLHttpRequest`;
    - el logout manda el access token (el claim `sid` identifica la familia: la cookie no viaja a `/api/auth/logout`, sub-decisión 11);
    - la UI pregunta por permisos en **un solo lugar**, `usePermission(módulo, acción)`, y solo oculta.
29. **Un solo refresh a la vez en todo el navegador (BE-1c, 2026-10-10, sin consulta).** El refresh del frontend (el que dispara un 401 y el del arranque) corre dentro de `navigator.locks.request('sdgpd-auth-refresh', …)`: todas las pestañas comparten la cookie de refresh, y dos refresh a la vez con la misma cookie son un reuso para el servidor, que revoca la familia (sub-decisión 14) y cierra la sesión en las dos. Con el lock, la segunda pestaña espera a la primera y refresca con la cookie ya rotada. El single-flight por pestaña (sub-decisión 28) sigue adentro del lock. Si `navigator.locks` no existe, se refresca sin lock (como en BE-1b) y se avisa una vez por consola en modo debug; sin polyfill. **La detección de reuso del servidor no cambia.** Probado con `FrontEnd/scripts/smoke/be-1c.smoke.mjs`, contra un servidor con la misma rotación y detección de reuso.

## Objeciones

1. **Cookie `HttpOnly` y "futura app de chofer".** El refresh en cookie `HttpOnly` funciona en el navegador. Una app nativa no tiene cookie jar de navegador y suele guardar el refresh en el almacenamiento seguro del dispositivo, mandándolo en el body. Escrita tal cual, la decisión no cubre ese caso. Cuando exista la app, el endpoint de refresh va a necesitar aceptar también el token en el body, o la app va a ser una PWA. No hay evidencia en el repo de que la app sea nativa ni web; queda anotado.

   **Resolución (2026-10-08):** **el login recibe el tipo de cliente.** Web: refresh en cookie. Nativa: refresh en el body de la respuesta del login y en el body del request de `/auth/refresh`, con la misma rotación y la misma detección de reuso. El contrato ya lo prevé (decisión 1); se implementa cuando exista la app.
2. **`SameSite` y orígenes distintos:** si `VITE_API_BASE_URL` (`httpClient.ts:60-61`) apunta a otro **site** que el del frontend, una cookie `SameSite=Strict` (o `Lax`) no viaja en el refresh. La decisión asume frontend y API en el mismo site (mismo dominio registrable).

   **Resolución (2026-10-08):** **confirmado: frontend y API se sirven en el mismo site.** En desarrollo, Vite hace **proxy de `/api`** al backend, así que es el mismo origen y la cookie viaja sin configuración extra. La cookie `SameSite=Strict` de la sub-decisión 3 queda como está.
