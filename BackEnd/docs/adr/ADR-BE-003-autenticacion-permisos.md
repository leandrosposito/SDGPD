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

1. **Access token corto** (Bearer, guardado en memoria del cliente) más **refresh token rotativo** en cookie `HttpOnly`, `Secure` y `SameSite`. El esquema sirve para la web y para una futura app de chofer. **Contraseñas con argon2id.**
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

- Endpoints de auth (sub-decisión 1): `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/session`.
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

## Sub-decisiones tomadas al redactar (pendientes de revisión)

1. **Paths de auth:** `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/session` (sustantivo `auth` más acción, siguiendo la convención de acciones de ADR-BE-004).
2. **Access token:** JWT firmado, con duración de **15 minutos**. Claims: `sub` (usuario), `emp` (empresa), `rol`, `ver` (versión de permisos, para invalidar tokens cuando cambian los permisos).
3. **Refresh token:** opaco, **30 días**. Se guarda hasheado en la base, con rotación en cada uso y **detección de reuso** (si se presenta un refresh ya usado, se revoca toda la familia). Cookie con `Path=/auth/refresh` y `SameSite=Strict`.
4. **CSRF de `/auth/refresh`:** exige el header `X-Requested-With`. Como el único endpoint con cookie no ejecuta comandos de negocio, no hace falta token CSRF.
5. **Un rol por usuario**, no varios. Los 4 `SystemRole` actuales (`Admin`, `Vendedor`, `Chofer`, `Deposito`) se siembran como roles iniciales de cada empresa, y la empresa puede editarlos.
6. **Acciones de la matriz:** `ver`, `crear`, `editar`, `anular`, `aprobar`, `exportar`, `forzar` (este último, para el override de capacidad de ADR-011). Módulos: los 10 de `FrontEnd/src/modules/`.
7. **Email único global**, consecuencia de "un usuario pertenece a una sola empresa", necesaria para el login sin tenant (ADR-BE-002, sub-decisión 2).
8. **Parámetros de argon2id:** los valores recomendados por OWASP vigentes al implementar, con los parámetros guardados junto al hash para poder subirlos después sin romper hashes viejos.

## Objeciones

1. **Cookie `HttpOnly` y "futura app de chofer".** El refresh en cookie `HttpOnly` funciona en el navegador. Una app nativa no tiene cookie jar de navegador y suele guardar el refresh en el almacenamiento seguro del dispositivo, mandándolo en el body. Escrita tal cual, la decisión no cubre ese caso. Cuando exista la app, el endpoint de refresh va a necesitar aceptar también el token en el body, o la app va a ser una PWA. No hay evidencia en el repo de que la app sea nativa ni web; queda anotado.
2. **`SameSite` y orígenes distintos:** si `VITE_API_BASE_URL` (`httpClient.ts:60-61`) apunta a otro **site** que el del frontend, una cookie `SameSite=Strict` (o `Lax`) no viaja en el refresh. La decisión asume frontend y API en el mismo site (mismo dominio registrable).
