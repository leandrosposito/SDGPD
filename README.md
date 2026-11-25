# SDGPD — ERP para distribuidoras

ERP web para distribuidoras mayoristas: cubre el circuito completo de pedidos, inventario, logística, compras, caja y analítica, con varias empresas aisladas en la misma base de datos.

**Stack:** TypeScript · React 19 · NestJS · PostgreSQL · Drizzle ORM · Zod · TanStack Query · Zustand · Vitest

## Qué tiene

- **10 módulos de negocio:** pedidos, clientes, proveedores, compras, inventario (con reposición), logística (vehículos, choferes, viajes y comprobante de entrega), caja, configuración, tablero y analítica.
- **Multi-empresa (multi-tenant):** cada distribuidora ve solo sus datos, con Row-Level Security en PostgreSQL y suites de tests que verifican el aislamiento.
- **Autenticación:** JWT con refresh token rotativo, usuarios, roles y matriz de permisos, y un guard global en la API.
- **Contrato de API compartido:** los schemas de Zod en `packages/contracts` los usan el backend y el frontend, así los dos validan lo mismo.
- **Frontend:** React 19 con TanStack Query y Zustand, formularios validados con Zod, paginación y exportación del lado del servidor, y code-splitting por ruta.
- **Robustez del backend:** idempotencia con HMAC, control de versión para escrituras concurrentes, auditoría y paginación.
- **27 decisiones de arquitectura documentadas (ADR):** 11 del backend y 16 del frontend.

## Estado

En desarrollo activo, en la rama `lean`:

- **Backend:** esqueleto, base de datos con RLS, autenticación, usuarios, roles y sucursales funcionando.
- **Frontend:** todos los módulos implementados. Autenticación, usuarios, roles y sucursales ya van contra la API real; el resto de los módulos todavía usa adaptadores con datos simulados mientras se construyen sus endpoints.

El plan de tandas del backend está en [`BackEnd/docs/README.md`](BackEnd/docs/README.md).

## Estructura

```
BackEnd/              API en NestJS + PostgreSQL (Drizzle ORM)
FrontEnd/             aplicación React (Vite)
packages/contracts/   contrato HTTP compartido (Zod)
docs/                 documentación transversal (protocolo de trabajo)
Documentacion/        visión de producto y especificación funcional del negocio
```

## Cómo correrlo

Requiere Node.js 24.

```bash
npm ci                                  # una sola vez, en la raíz
npm run dev -w distribuidoragestion     # frontend (Vite)
npm run start -w @sdgpd/backend         # backend, rutas bajo /api
npm test                                # tests de todos los workspaces
```

Configurar la base de datos: [`BackEnd/docs/SETUP_SUPABASE.md`](BackEnd/docs/SETUP_SUPABASE.md).

## Documentación

- Arquitectura del frontend: [`FrontEnd/docs/ARQUITECTURA.md`](FrontEnd/docs/ARQUITECTURA.md)
- Decisiones del frontend: [`FrontEnd/docs/adr/`](FrontEnd/docs/adr/)
- Decisiones del backend: [`BackEnd/docs/adr/`](BackEnd/docs/adr/)
- Protocolo de trabajo: [`docs/PROTOCOLO.md`](docs/PROTOCOLO.md)
- Negocio y dominio: [`Documentacion/README.md`](Documentacion/README.md)

---

Desarrollado por [Leandro Sposito](https://www.linkedin.com/in/leandrosposito).
