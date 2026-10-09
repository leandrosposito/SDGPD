# VERIFICACIÓN BE-1b — checklist de navegador

**Fecha:** 2026-10-09. Lo corre Leandro, con el backend y el seed levantados. Todo desde la raíz del repo (`C:\proyectos\SDGPD`), en Git Bash, con Node 24. **Ningún paso de esta lista se ejecutó en un navegador durante la sesión**: los gates prueban que el código compila, que los scripts pasan y que el proxy contesta, no que la pantalla se comporte bien.

**Secretos:** las credenciales del admin del seed están en `BackEnd/.env` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`; empresa B: `SEED_ADMIN_B_*`). Leelas de ahí y no las pegues en ningún lado.

## 0. Preparación

| # | Paso | Resultado esperado |
|---|---|---|
| 0.1 | `npm ci` (en la raíz: desde BE-1b hay un único lockfile) | termina sin errores; no existe `FrontEnd/package-lock.json` |
| 0.2 | `npm run db:migrate -w @sdgpd/backend` y `npm run db:seed-dev -w @sdgpd/backend` | `sin migraciones pendientes (7 en total)` y las dos líneas `ok` del seed. Si las sucursales demo tenían otros ids, la línea dice `(migradas a id fijo: …)` la primera vez |
| 0.3 | `npm run build -w @sdgpd/backend && npm run start -w @sdgpd/backend` (terminal 1) | `Mapped {/api/auth/login, POST}` … y `Nest application successfully started` |
| 0.4 | Crear `FrontEnd/.env.local` con la línea `VITE_HTTP_SERVICES=auth,session,users,roles,branches` (si ya tenías uno, guardalo aparte) | — |
| 0.5 | `npm run dev -w distribuidoragestion` (terminal 2) y abrir la URL que muestra (normalmente `http://localhost:5173`) | redirige a `/login` (no hay sesión). DevTools › Network: un `POST /api/auth/refresh` con 401 al cargar |

## 1. Login, recarga, token vencido y logout

| # | Paso | Resultado esperado |
|---|---|---|
| 1.1 | Login con el admin del seed | entra al Dashboard. Header: nombre "Admin Distribuidora La Proveedora S.A." y rol "Admin"; botón de cerrar sesión. Selector de sucursal: las 4 (Villa Maria marcada inactiva). Network: `POST /api/auth/login` 200 con `Set-Cookie: sdgpd_refresh=…; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict` |
| 1.2 | DevTools › Application: Local Storage, Session Storage y Cookies | **no** hay ningún access token. La única cookie es `sdgpd_refresh`, marcada HttpOnly (JS no la puede leer) |
| 1.3 | Recargar la página (F5) en `/inventario` | sigue en `/inventario`, con la sesión. Network: `POST /api/auth/refresh` 200 y después `GET /api/auth/session` 200 |
| 1.4 | Forzar el vencimiento del access token, sin esperar 15 minutos: en otra terminal, `npm run db:sql -w @sdgpd/backend -- app --tenant $(grep '^SEED_EMPRESA_ID=' BackEnd/.env \| cut -d= -f2) --commit "update users set permissions_version = permissions_version + 1 where email = '$(grep '^SEED_ADMIN_EMAIL=' BackEnd/.env \| cut -d= -f2)'"` (sube la versión de permisos: el token emitido antes deja de valer). Volvé al navegador y abrí Configuración › Usuarios y Roles | la pantalla carga normal. Network: un request con 401, **un solo** `POST /api/auth/refresh` 200 y el mismo request repetido con 200. Ningún loop de refresh |
| 1.5 | Logout (botón del header) | vuelve a `/login`. Network: `POST /api/auth/logout` 204 y la cookie se borra. La flecha "atrás" del navegador no muestra la app: vuelve al login |
| 1.6 | Recargar en `/login` después del logout | sigue en el login (el refresh da 401) |

## 2. Permisos en la UI

| # | Paso | Resultado esperado |
|---|---|---|
| 2.1 | Como admin: Configuración › Usuarios y Roles › **Nuevo Usuario**: email `chofer@sdgpd.local`, contraseña de 12 o más caracteres, rol **Chofer**, activo, sucursal **solo Sucursal Centro** | toast "Usuario creado." y aparece en el listado con rol Chofer y sucursal CTR |
| 2.2 | En una ventana de incógnito (otra cookie), login con `chofer@sdgpd.local` | entra. El selector de sucursal muestra **solo Sucursal Centro**, estático (no es un desplegable) |
| 2.3 | Como Chofer, ir a Inventario | **no** aparecen "Registrar Compra", "Nuevo Producto" ni "Editar" en la tabla de stock. La pantalla igual muestra los datos (Inventario sigue en mock: la UI solo oculta) |
| 2.4 | Como Chofer, ir a Configuración › Usuarios y Roles | el aviso "No tenes permiso para ver usuarios y roles (hace falta settings.ver)", sin listado ni matriz. Network: ningún request a `/api/users` ni a `/api/roles` |
| 2.5 | Como admin, editar al Chofer: darle también Sucursal Norte. En la ventana del Chofer, recargar | el selector ahora ofrece Centro y Norte |

## 3. Matriz y último admin

| # | Paso | Resultado esperado |
|---|---|---|
| 3.1 | Como admin (el único con `settings.editar`), en la matriz, rol **Admin**: destildar `Configuracion › editar` y **Guardar matriz** | toast de error: "No se puede: la empresa se quedaria sin ningun usuario activo que pueda editar usuarios y permisos…". La matriz no cambia (al recargar sigue tildado) |
| 3.2 | Editarte a vos mismo: rol Vendedor (o destildar Activo) y guardar | el mismo mensaje (422 `last-admin`), dentro del formulario y en un toast |
| 3.3 | Crear otro usuario con rol Admin, y repetir el 3.2 | ahora sí guarda. La UI se actualiza: desaparecen los botones de edición (perdiste `settings.editar`). Volvé a dejarte Admin desde el otro usuario |
| 3.4 | Conflicto de versión: abrir la edición del Chofer en dos pestañas del admin; guardar un cambio en una y después otro en la otra | la segunda muestra "Alguien modifico este registro mientras lo editabas…" y el listado se recarga |

## 4. Los módulos en mock siguen igual

| # | Paso | Resultado esperado |
|---|---|---|
| 4.1 | Como admin, con Sucursal Centro: Pedidos, Logística e Inventario | muestran datos, igual que antes de BE-1b |
| 4.2 | Cambiar a Sucursal Norte y a Sucursal Sur en el selector | cada módulo filtra y muestra los datos de esa sucursal (los ids del mock son los mismos del seed) |
| 4.3 | Borrar `FrontEnd/.env.local` (o vaciar `VITE_HTTP_SERVICES`) y reiniciar `npm run dev` | la app abre directo, sin login, con la sesión mock (Lucia Fernandez, Admin), como antes de BE-1b. `/login` redirige al inicio. Configuración › Usuarios y Roles funciona sobre el mock (alta, edición, matriz y el 422 de último admin) |
