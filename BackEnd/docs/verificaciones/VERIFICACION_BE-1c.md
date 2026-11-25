# VERIFICACIÓN BE-1c — checklist de navegador

**Fecha:** 2026-10-10. Lo corre Leandro, con el backend y el seed levantados, igual que en `VERIFICACION_BE-1b.md` (sección 0: `npm ci` en la raíz, `db:migrate`, `db:seed-dev`, backend en `/api`, `FrontEnd/.env.local` con `VITE_HTTP_SERVICES=auth,session,users,roles,branches` y `npm run dev -w distribuidoragestion`). **Nada de esto se ejecutó en un navegador durante la sesión.**

## 1. Dos pestañas: el refresh no cierra la sesión

| # | Paso | Resultado esperado |
|---|---|---|
| 1.1 | Login con el admin del seed. Abrí una **segunda pestaña** con la misma URL | las dos muestran la app con sesión (la segunda hace su refresh al cargar). DevTools › Network en cada una: un `POST /api/auth/refresh` 200 |
| 1.2 | Forzar el vencimiento del access token de las dos: `npm run db:sql -w @sdgpd/backend -- app --tenant $(grep '^SEED_EMPRESA_ID=' BackEnd/.env \| cut -d= -f2) --commit "update users set permissions_version = permissions_version + 1 where email = '$(grep '^SEED_ADMIN_EMAIL=' BackEnd/.env \| cut -d= -f2)'"` | — |
| 1.3 | Recargar **las dos pestañas casi a la vez** (F5 en una e inmediatamente en la otra) | **las dos siguen con sesión.** En Network, cada una hace su `POST /api/auth/refresh` y los dos dan 200, uno después del otro (no se pisan). Ninguna vuelve al login |
| 1.4 | Repetir el 1.2 y, sin recargar, navegar a la vez en las dos (por ejemplo, abrir Configuración › Usuarios y Roles en ambas) | las dos cargan. En cada una: un request 401, su refresh 200 y el reintento 200 |
| 1.5 | Control del servidor: en una terminal, `npm run db:sql -w @sdgpd/backend -- app --tenant $(grep '^SEED_EMPRESA_ID=' BackEnd/.env \| cut -d= -f2) "select count(*) filter (where revoked_at is not null) as revocados, count(*) as total from refresh_tokens"` | después de los pasos de arriba no hay familias revocadas por reuso que no sean de logouts tuyos (si no hiciste logout, `revocados` = 0) |
| 1.6 | Navegador sin Web Locks (opcional, solo si tenés uno viejo a mano), con `VITE_API_DEBUG=true` | en la consola, una sola vez: `[httpClient] navigator.locks no existe: el refresh no se coordina entre pestanas…`. La app funciona como en BE-1b |

## 2. Una sola zod: nada cambió en la UI

| # | Paso | Resultado esperado |
|---|---|---|
| 2.1 | Login con un email inválido (`no-es-email`) y con la contraseña vacía | los mensajes de validación de siempre ("El email no es valido", "Ingresa tu contrasena"): zod 4.4.3 valida igual |
| 2.2 | Configuración › Usuarios y Roles: alta de un usuario con una contraseña de menos de 12 caracteres | "Al menos 12 caracteres" |
| 2.3 | Formularios de otros módulos que usan zod (Nuevo Producto en Inventario, Nueva Orden en Compras): abrir, dejar un campo obligatorio vacío y guardar | los mismos mensajes de error que antes |
| 2.4 | DevTools › Network › JS, al cargar la app | se carga un solo `vendor-zod-*.js` (~69 kB), no ~155 kB |
