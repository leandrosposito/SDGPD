# AUDIT 00 — Resumen consolidado

**Fecha:** 2026-09-06. **Commit auditado:** `cef6e15` (rama `lean`, `origin/lean`, working tree limpio salvo `docs/auditorias/` sin trackear — la carpeta que contiene esta misma ronda de auditorías).

Consolida las 14 auditorías de FASE A (`AUDIT_1` a `AUDIT_14`), todas de solo lectura — ningún archivo de código fuente fue modificado en esta fase. Cada fila cita el archivo fuente donde está el detalle completo (contexto, cita de código, impacto razonado); este documento no repite ese detalle, resume y ordena.

## Bloqueantes: ninguno

Ninguna de las 14 auditorías encontró un hallazgo de severidad BLOQUEANTE. En particular, las dos áreas donde el prompt maestro exige tratamiento BLOQUEANTE explícito se revisaron a fondo y están correctas hoy:

- **Aislamiento de datos entre empresas (A5):** `empresaId` es obligatorio (sin default) en ambas factories de query key (`pagedQueryKey`/`cachedQueryKey`) y en ambos hooks de fetching — TypeScript no compila una query de este proyecto que lo omita. Ningún listado de alcance sucursal deja `branchId` fuera de la key.
- **Persistencia que sobreviva a un cambio de empresa/logout (A6):** el único dato de negocio-adyacente persistido en `localStorage` es `activeBranchId` (validado contra la sesión real al rehidratarse, nunca usado como autorización); no hay ningún catálogo, listado ni cifra de dominio persistido. No existe flujo de logout todavía, así que ese escenario no tiene código que auditar aún (ver pregunta abierta en A6).

Esto no significa que no haya deuda seria — hay 11 hallazgos ALTO que conviene resolver antes o durante Fase C — pero ninguno corrompe datos entre empresas/sucursales ni bloquea la Fase B (ADRs) tal como está.

**A15 (2026-09-09, Logística/Entregas) confirma lo mismo en su alcance**: `empresaId` sigue siendo obligatorio en `DeliveryQueryFilters` (ya corregido en el barrido de empresaId de sesión anterior) y no se encontró ningún hallazgo BLOQUEANTE — los 13 hallazgos nuevos (5 ALTO, 3 MEDIO, 5 BAJO, sumados a la tabla de abajo) son gaps funcionales frente al modelo logístico objetivo (ADR-010/011), no corrupción de datos ni regresión de algo que funcionaba.

## Cobertura

| Auditoría | Archivo | Hallazgos (A/M/B) |
|---|---|---|
| A1 — Línea base build/tipos | `AUDIT_1_BASELINE.md` | 0/0/0 (línea base limpia) |
| A2 — Capa api/ y services | `AUDIT_2_CAPA_API_SERVICES.md` | 2/2/0 |
| A3 — Paginación y volumen | `AUDIT_3_PAGINACION_VOLUMEN.md` | 2/1/1 |
| A4 — Identificadores y relaciones | `AUDIT_4_IDS_RELACIONES.md` | 1/1/1 |
| A5 — Alcance empresa/sucursal | `AUDIT_5_SCOPE_EMPRESA_SUCURSAL.md` | 0/2/2 |
| A6 — Estado global (Zustand) | `AUDIT_6_ESTADO_GLOBAL.md` | 0/0/2 |
| A7 — Caché e invalidación | `AUDIT_7_CACHE_INVALIDACION.md` | 0/1/2 |
| A8 — Render y bundle | `AUDIT_8_RENDER_BUNDLE.md` | 2/1/1 |
| A9 — Formularios y validación | `AUDIT_9_FORMULARIOS_VALIDACION.md` | 1/1/1 (+1 positivo) |
| A10 — Dinero y cantidades | `AUDIT_10_DINERO_CANTIDADES.md` | 2/1/2 |
| A11 — Fechas y zona horaria | `AUDIT_11_FECHAS_ZONA_HORARIA.md` | 1/2/1 |
| A12 — Errores, carga, vacíos | `AUDIT_12_ERRORES.md` | 0/0/2 |
| A13 — Rutas y deep links | `AUDIT_13_RUTAS.md` | 1/1/1 |
| A14 — Deuda declarada | `AUDIT_14_DEUDA_DECLARADA.md` | 2/2/5 (+1 info) |
| A15 — Logística / Entregas (2026-09-09, posterior a las 14 de arriba — ver nota) | `AUDIT_15_LOGISTICA.md` | 5/3/5 |

**Nota sobre A15:** a diferencia de A1-A14 (todas del 2026-09-06, antes de Fase B/C), A15 se hizo el 2026-09-09, después de que Tandas 4-8 y varias sesiones más ya estuvieran mergeadas a `lean` — es una auditoría de re-entrada acotada al módulo de Logística/Entregas, no una repetición de las 14 originales. Sus hallazgos se numeran continuando la secuencia de abajo (47+), agrupados por severidad igual que el resto; los números no son estrictamente correlativos dentro de cada sección porque se insertaron después, no se renumeró todo el documento.

Tres hallazgos aparecen en más de una auditoría, mirados desde ángulos distintos (services, volumen, deuda declarada) — se consolidan en una sola fila de la tabla siguiente, citando todas sus fuentes: **Reposición/Tanda 3f sin migrar** (A2#1 + A3#1 + A14#5) y **Analytics sin service** (A2#4 + A3#2). El par de A8 (#1 code-splitting / #2 bundle único) también se fusiona en una fila porque el propio audit los marca como una sola causa/solución.

## Tabla consolidada (ordenada por severidad)

Esfuerzo estimado en talle (S ≈ ≤1 día, M ≈ 2-4 días, L ≈ 1-2 semanas, XL ≈ requiere ADR/decisión antes de poder estimar) — son estimaciones de una sola persona familiarizada con el código, no compromisos.

### ALTO

| # | Área | Fuente(s) | Hallazgo | Esfuerzo |
|---|---|---|---|---|
| 1 | Reposición (inventory) | A2#1, A3#1, A14#5 | Tanda 3f nunca iniciada: `TabPurchases` lee `INVENTORY_MOCK_DATA.suggestions` directo, filtrado en cliente, sin service ni `usePagedQuery` — único listado de datos reales de toda la app sin ningún techo de tamaño. | M — mismo patrón ya usado 10 veces (`api/` + `usePagedQuery`), pero es una tanda completa. |
| 2 | Analytics | A2#4, A3#2 | Sin ningún service ni contrato de agregado — lectura síncrona de un objeto estático, sin `isLoading`/`error` posibles. Riesgo si se le pide calcular agregados reales sin backend (anti-patrón que Tanda 7 busca evitar). | S — mismo patrón que `dashboard.service.ts`, ya usado 9 veces. |
| 3 | Orders/Logistics/Cash × Clients | A4#1 | `Order`, `Delivery`, `CashTransaction` no tienen ningún campo de relación (`clientId`) hacia `ClientAccount` — nombre de cliente es texto libre tipeado a mano, sin ningún intento de join. Impide reportes cruzados y cuenta corriente automática. | L — requiere decisión de producto primero (ver pregunta abierta A4#1) antes de tocar 3 tipos + `CreateOrderModal` + mappers/services. |
| 4 | Bundle/rendimiento | A8#1, A8#2 | Los 9 módulos se importan estáticamente (sin `React.lazy`), bundle único de 1.470 kB sin `manualChunks` — cualquier usuario descarga los 9 módulos aunque solo use uno. | S — envolver los `import` de `AppRoutes.tsx` en `React.lazy`+`Suspense`, sin tocar lógica de negocio. |
| 5 | Formularios | A9#1 | 4 de 6 formularios de alta/edición (Proveedores, Clientes, Pedidos, Caja) no usan Zod/react-hook-form pese a ser convención documentada como obligatoria — validación ad-hoc dispersa, permite guardar campos vacíos. | M — 4 migraciones independientes y acotadas, no una tanda obligatoria de una sola vez. |
| 6 | Dinero (representación) | A10#1 | Toda cifra monetaria del dominio es `number` JS sin unidad mínima definida (ni centavos-enteros ni decimal-string) — riesgo de arrastre de error de punto flotante a escala real. | XL — requiere ADR/decisión de Leandro antes de poder estimar la migración. |
| 7 | Dinero (redondeo) | A10#2 | `OrderTotalsSection` encadena multiplicaciones/sumas de floats (IVA, descuento) sin ningún redondeo de negocio antes de persistir `totalAmount` — solo se redondea al mostrar. | S — pero depende de #6 (definir antes dónde/cómo redondear). |
| 8 | Fechas (bug real) | A11#1 | `CreateOrderModal` prellena la fecha de pedido con `toISOString().split('T')[0]` — da el día siguiente en horario nocturno en Argentina (UTC-3). Bug reproducible, no solo deuda de diseño. | S — fix de una línea, usando el helper `toISODateString` que ya existe y ya es correcto en otros lugares del propio código. |
| 9 | Rutas/deep links | A13#1 | Filtros/página/orden de los 13 listados paginados viven solo en memoria (`useState`), nunca en la URL — imposible compartir un link directo a un listado filtrado, y un F5 pierde el estado. | M-L — helper compartido de serialización + 13 consumidores a migrar. |
| 10 | Verificación funcional | A14#1 | 5 tandas (3a Pedidos, 3b Caja, 3c Settings, 3d Clientes, 3g Movimientos/Historial) cerradas a nivel de código con checklist de navegador 100% sin ejecutar, incluidos los puntos centrales de cada una. | S (para Leandro) — los checklists ya están escritos, es ejecución mecánica, no código nuevo. |
| 47 | Logística | A15#1 | No existe ninguna función para crear una `Delivery` nueva en todo el proyecto — las 18 entregas del mock son estáticas, sin ningún camino manual ni automático para que un pedido genere una entrega. | — (techo funcional, no de volumen): el módulo no puede operar sobre datos reales hasta que exista. | Insumo directo de ADR-010/011 (motor de asignación), no una corrección de esta ronda. |
| 48 | Logística | A15#2 | `OrderStatus` (`order.types.ts:15`) mezcla estado comercial, logístico y financiero en una sola columna — un pedido no puede representar "facturado y con una línea rechazada" sin perder uno de los dos hechos. | Cada estado logístico nuevo que se agregue multiplica combinaciones imposibles de expresar en una sola columna. | Insumo directo de ADR-010 punto 1 (tres ejes independientes). |
| 49 | Logística | A15#3 | Finalizar una `Delivery` (`registrarEntrega`) nunca actualiza `Order.status`, que solo avanza por click manual en otra pantalla — ambos estados pueden divergir indefinidamente sin que nada lo detecte. | A más entregas por día, más pedidos quedan con `Order.status` desactualizado esperando un click manual — no escala con operación real. | Insumo directo de ADR-010 punto 1/3. |
| 50 | Logística | A15#5 | Ninguna de las 3 mutaciones de entregas (`transitionDelivery`/`reprogramDelivery`/`registrarEntrega`) tiene clave de idempotencia — un reintento de red desde el celular de un chofer puede duplicar un remito. | Con choferes en zonas de mala señal, un doble-submit duplicaría `cantidadEntregada` aplicada al pedido — corrompe el dato de cumplimiento. | Insumo directo de ADR-010 punto 4. |
| 51 | Logística | A15#6 | Sin ningún campo de Proof of Delivery (receptor, firma, ubicación, timestamp de dispositivo) — la evidencia solo existe hoy para rechazos, nunca para una entrega exitosa. | — (capacidad ausente, no problema de escala). | Insumo directo de ADR-010 punto 7. |

### MEDIO

| # | Área | Fuente(s) | Hallazgo | Esfuerzo |
|---|---|---|---|---|
| 11 | Services | A2#2 | 3 convenciones de ubicación de servicio conviven sin reconciliar (`modules/<x>/api/`, `services/mock/`, `modules/logistics/services/`), sin regla escrita de cuál seguir para un dominio nuevo. | S — solo documentar en `DECISIONES_TECNICAS.md`, no mover archivos. |
| 12 | Services | A2#3 | `fetchSession()` es el único fetch de negocio que no pasa por `httpClient` (sin timeout/reintentos/`ApiError`/cancelación). | S — un archivo, una función. |
| 13 | Paginación | A3#3 | Los 13 listados paginan por offset, nunca cursor, sin razón escrita — contradice la preferencia por cursor de la Sección 5 del prompt maestro. | S (documentar la decisión) / L (migrar a cursor, no urgente). |
| 14 | IDs | A4#2 | Todos los IDs son `string` plano, sin branded types — TypeScript no distingue `productId` de `branchId` en la misma firma (ejemplo concreto: `getStockForBranch`). Insumo directo de ADR-006. | — (no accionable hasta ADR-006, Fase B). |
| 15 | Invalidación de cache | A5#1 | 7 de 8 call-sites de `invalidateQueries` arman la key a mano en vez de usar la factory — coincide hoy, pero nada en TypeScript fuerza que siga coincidiendo. | S — exportar helpers de prefijo desde `queryKeys.ts`. |
| 16 | Seguridad de contrato | A5#2 | `empresaId` viaja hoy como parámetro explícito a cada service (`params`/`body` a `httpClient`), lo cual contradice literalmente el comentario de diseño original ("la empresa nunca es un parámetro que el frontend controle"). Sin riesgo real hoy (una sola empresa, sin backend), pero es la semilla de un IDOR cross-tenant si el backend real llega a confiar en ese valor en vez de derivarlo del token. | S (actualizar el comentario + dejarlo en un ADR) — la corrección real es responsabilidad del backend futuro. |
| 17 | Caché | A7#1 | `usePagedQuery` no permite override de `staleTime`/`gcTime` por listado (a diferencia de `useCachedQuery`, que sí lo exige). No es un problema hoy porque todos los listados actuales comparten la misma volatilidad. | S — campo opcional aditivo, retrocompatible. |
| 18 | Formularios | A9#2 | `NewTransactionModal` maneja `amount` como `useState<string>` convertido con `Number(...)` sin coerción declarada — mismo problema de fondo que Zod ya resuelve en los otros 2 formularios. | S — parte natural de migrar este formulario a Zod (hallazgo ALTO #5). |
| 19 | Dinero | A10#3 | Patrón `cantidad × precioUnitario` repetido en 4 lugares sin centralizar; a diferencia de Compras (`computePurchaseOrderTotal`, nunca persiste un total propio), Pedidos sí persiste `totalAmount` calculado en cliente sin volver a derivarlo. | M — evaluar si Pedidos debe adoptar el mismo patrón que Compras (derivar siempre, nunca confiar en el valor del cliente). |
| 20 | Fechas | A11#2 | Vencimiento de lotes (`ProductLotsPanel`) se compara contra hora exacta (`getTime()`) en vez de día calendario — un lote puede pasar a "vencido" hasta 3 horas antes/después del corte de calendario esperado, según la zona horaria del usuario. | S — usar comparación de string `yyyy-MM-dd`, mismo patrón ya correcto en `clients.service.ts`. |
| 21 | Fechas | A11#3 | Aging de facturas (`daysOverdue`) corta el "día" a las 10:00 (hora fija del mock) en vez de a medianoche — dos consultas el mismo día calendario pueden mostrar tramos de mora distintos. | S — normalizar a medianoche antes de calcular la diferencia de días. |
| 22 | Rutas | A13#2 | El único uso real de `useSearchParams` del proyecto es un mecanismo de "traspaso" de acción entre pantallas (`ComprasPage`), no de persistencia de estado de vista — no resuelve el caso general del hallazgo ALTO #9, aunque es buen precedente de patrón. | — (informativo, no requiere acción propia). |
| 23 | Deuda declarada | A14#2 | Tanda 3e (Stock Actual + Bajo Stock Mínimo) tiene 1 de 12 puntos de su checklist verificados en navegador — incluida toda la funcionalidad nueva de búsqueda/orden server-side. | S (para Leandro) — checklist ya escrito. |
| 24 | Deuda declarada | A14#3 | La tabla de resultados de `VERIFICACION_TANDA_2.md` tiene sus 7 celdas vacías en vez de "No ejecutado" explícito — inconsistencia de formato que facilita pasarlo por alto. | S — completar el texto de la tabla. |
| 52 | Logística | A15#4 | Un pedido puede tener múltiples `Delivery` (18 para 6 pedidos en el mock) sin ninguna relación explícita entre ellas — no se puede distinguir "reintento de la misma mercadería" de "despacho parcial genuino" solo con el dato. | Un reporte que sume cantidades/`collectionAmount` de todas las `Delivery` de un pedido sobre o subestima según cuál sea el caso real. | Insumo directo de ADR-010 punto 2 (jerarquía Viaje→Parada→Entrega). |
| 53 | Logística | A15#7 | La mercadería rechazada no toca stock ni caja en ningún punto del código — desaparece del sistema sin generar ningún movimiento contable. | Cuanta más mercadería se rechace, más diverge el stock/caja real del que el sistema cree tener, sin rastro. | Insumo directo de ADR-010 punto 6 (logística inversa). |
| 54 | Verificación funcional | A15#8 | `VERIFICACION_TANDA_8.md` (Entregas), 10 puntos, sin ninguna evidencia de ejecución — no estaba capturado en el hallazgo ALTO #10 (que solo lista 5 tandas anteriores a Tanda 8). | — (deuda de verificación, no de código). | Ejecutarlo antes de extender el módulo hacia ADR-010/011. |

### BAJO

| # | Área | Fuente(s) | Hallazgo | Esfuerzo |
|---|---|---|---|---|
| 25 | Paginación | A3#4 | `setPageSize` nunca se usa — no hay selector de "filas por página" en la UI (nota informativa, no un problema activo). | — |
| 26 | IDs | A4#3 | Campos de texto libre menores sin relación tipada (`AuditLogItem.user`, `TopDebtor.id` sin anotar como `ClientAccount['id']`, `sellerName`) — impacto bajo por ser vistas de solo lectura/reporte. | S cuando se necesite navegación real desde estos campos. |
| 27 | Scope empresa/sucursal | A5#3 | El Dashboard no filtra por empresa ni por sucursal — el mock es idéntico sin importar el contexto activo; falta confirmar el alcance esperado antes de Tanda 7. | — (pregunta abierta, no código). |
| 28 | Scope empresa/sucursal | A5#4 | El alcance de `compras` (Órdenes de Compra) — empresa con filtro opcional de sucursal, como está hoy — nunca se confirmó explícitamente junto con el resto de los dominios del punto 0 del prompt maestro. | — (pregunta abierta). |
| 29 | Estado global | A6#1 | El registro de stores "resettable" al cambiar de sucursal depende 100% de disciplina manual (`registerResettableStore`), sin ningún lint/tipo que detecte un store nuevo que se olvide de registrarse. | S — factory `createResettableStore` que registre automáticamente, cuando se agregue el próximo store. |
| 30 | Estado global | A6#2 | `useSessionStore` mezcla `session` (server state) con `activeBranchId` (UI state) en el mismo store — inconsistente con el resto del proyecto, que separa con cuidado TanStack Query de Zustand. | M — candidato natural para la Tanda 4 (selector de sucursal), que ya toca este store. |
| 31 | Caché | A7#2 | La key `'dashboard'` no tiene ningún `invalidateQueries` que la mencione — inofensivo hoy porque el mock no deriva de otros dominios; sí importa cuando Tanda 7 lo convierta en agregados reales. | — (requisito a incorporar en Tanda 7, no deuda actual). |
| 32 | Caché | A7#3 | `AuditLogWidget` usa la categoría `OPERATIONAL` (30s) de `staleTime` para un log append-only — funciona, pero la categorización no está razonada por escrito para este caso puntual. | — |
| 33 | Render | A8#3 | `Table.tsx` no virtualiza ni memoiza filas — seguro hoy porque la paginación server-side acota el N (`pageSize` default 25); sería un problema solo si algún listado trajera una colección completa sin paginar. | — (no urgente mientras la política de paginación se sostenga). |
| 34 | Render | A8#4 | `React.memo` no se usa en ningún componente del proyecto; `useCallback` solo una vez. Laguna estructural, no un problema activo a ≤100 filas por página. | — |
| 35 | Formularios | A9#3 | CUIT `'30-11111111-1'` hardcodeado como "duplicado" en 2 lugares del código de Clientes, sin validación real de formato de CUIT en ningún formulario (a diferencia del EAN-13 de productos, que sí valida dígito verificador). | — (se resuelve naturalmente al migrar a Zod, hallazgo ALTO #5). |
| 36 | Dinero | A10#4 | Único uso de `Math.round` en todo el código de dinero/cantidades aplica a un porcentaje de UI (KPI), correctamente aislado de cualquier cálculo que se persista. | — |
| 37 | Dinero | A10#5 | 19 implementaciones locales casi idénticas de `formatCurrency` (`Intl.NumberFormat`), sin un helper compartido en `src/shared/`. | S — extraer un helper único, cambio mecánico. |
| 38 | Errores/carga | A12#1 | El error de `usePagedQuery`/`useCachedQuery` se comunica casi siempre solo vía toast (Sonner) sin estado inline persistente — si el toast desaparece, una lista con error es indistinguible de una lista genuinamente vacía. | M — agregar un estado de error inline con "Reintentar" en el contenedor de tabla compartido. |
| 39 | Errores/carga | A12#2 | No se revisó uno por uno los ~15 consumidores de `usePagedQuery`/`useCachedQuery` para confirmar consistencia total del patrón de error inline vs. solo-toast — nota de cobertura, no hallazgo cerrado. | — |
| 40 | Rutas | A13#3 | Ninguna ruta declara un param dinámico (`:id`) — no hay hoy ningún caso de "detalle de entidad por id en la URL" que auditar. | — (relevante recién si se decide deep-link a detalle de entidad, ver Tanda 8). |
| 41 | Deuda declarada | A14#4 | Tanda 2.5 tiene 2 de 7 puntos verificados — son justamente los 2 que motivaron la tanda, así que lo esencial sí está confirmado. | S (para Leandro). |
| 42 | Deuda declarada | A14#6 | Falta el botón "Editar" en Proveedores — la lógica ya existe completa, solo falta el disparador de UI. | S. |
| 43 | Deuda declarada | A14#7 | `updateProduct` descarta los lotes (`ProductLot[]`) existentes al editar un producto — bug preexistente, confirmado y preservado sin cambios en Tanda 3e. | S — conservar `lots` del registro anterior salvo edición explícita. |
| 44 | Deuda declarada | A14#9 | 4 tabs de Inventory (Ajustes, Categorías, Listas de Precios, Import/Export) son UI construida sin funcionalidad real — features futuras documentadas, no código muerto a borrar. | — (registro, no acción). |
| 45 | Deuda declarada | A14#10 | `StockAdjustmentModal.tsx` sigue huérfano, no montado en ningún lado. | — (sin acción salvo que se decida implementar ajuste manual de stock). |
| 55 | Logística | A15#9 | `getDeliveryNotesForDelivery` no pagina — acotado de hecho hoy (máximo 1 remito por entrega, `FINALIZADO` es terminal), pero deja de estarlo en el momento en que se habiliten reintentos con múltiples remitos por entrega. | Bajo hoy; relevante en cuanto ADR-010 habilite más de un remito por entrega. | Si se habilita, paginar en la misma tanda — no esperar a que se note en producción. |
| 56 | Logística | A15#10 | `toISODate` (`deliveries.service.ts:63-68`) exportada sin ningún consumidor real — el mock tiene su propia copia local. | — | No borrar (regla del protocolo); candidata a limpieza si ADR-010 no la necesita. |
| 57 | Logística | A15#11 | IDs de eventos/remitos generados con `Date.now()` sin garantía real de unicidad — colisión improbable en el mock single-thread, mal patrón si migra a backend con escritura concurrente. | Bajo con el volumen mock actual. | Reemplazar por ID server-side con unicidad garantizada cuando exista backend real. |
| 58 | Logística | A15#12 | El botón "Imprimir Hoja de Ruta" (`LogisticsPage.tsx:130-133`) no hace nada más que un `console.log` — promete una función que no existe. | — | Insumo de ADR-011 punto 7 (documentos impresos vía job server-side). |
| 59 | Logística | A15#13 | `DeliveryNote.id`/`DeliveryHistoryEvent.id` son `string` plano, sin branded type, a diferencia de `DeliveryId`/`OrderId`/`OrderLineId`. | — | Si ADR-010 amplía la jerarquía de entidades, tipar los IDs nuevos desde el día uno. |

### INFO

| # | Área | Fuente(s) | Hallazgo |
|---|---|---|---|
| 46 | Deuda declarada | A14#8 | Tanda 3g (branchId en `InventoryMovement`/`ProductHistoryEvent`) cerrada a nivel de código con script de verificación contra datos crudos, pero sin verificación en navegador — mismo tratamiento que el ALTO #10, se separa porque es la tanda que más directamente habilita Fase C (Tanda 4). |

## Qué está bien en general (para no romperlo después)

Patrones que las 14 auditorías confirman como sólidos y consistentes, y que cualquier tanda de Fase C debería preservar en vez de "descubrir de nuevo":

- **`empresaId` obligatorio en toda query key, sin excepción** (A5) — es la base de por qué no hay ningún hallazgo BLOQUEANTE de aislamiento.
- **Cero servicios duplicados, cero `fetch()` suelto** (A2) — el único `httpClient` centralizado es el único camino de acceso a datos en los 12 dominios migrados.
- **Cero mutaciones huérfanas** (A7) — las 12 mutaciones reales del proyecto invalidan o refetchean correctamente.
- **Los 13 listados paginados son genuinamente server-paginados**, con filtros/orden/agregados resueltos antes de recortar la página (A3) — nunca `.length` de la página usado como total real.
- **`ClientAccount`/`InventoryItem.supplierId`/`Delivery.orderId` son relaciones tipadas correctas** (A4) — el patrón existe y funciona bien donde se aplicó a propósito; el problema (ALTO #3) es que nunca se extendió a `Order`/`CashTransaction`.
- **Los 6 `export*` ya respetan `MAX_EXPORT_ROWS=10.000` con `truncated`** (A3) — adelantado correctamente a la Tanda 6, antes incluso de que exista.
- **Ningún selector de Zustand construye un valor nuevo por render** (A6, A8) — cero riesgo de loops de `useSyncExternalStore` hoy.
- **`ErrorBoundary` en dos niveles + `httpClient` con timeout/reintentos/`ApiError` estructurado, simulables vía variables de entorno** (A12) — sustancialmente mejor que lo que describía la auditoría de escalabilidad vieja (`docs/AUDITORIA_ESCALABILIDAD.md`, 2026-09-03).
- **Los 2 formularios que sí usan Zod (Productos, Órdenes de Compra) están completos y sin atajos** (A9) — el patrón a replicar en los otros 4 ya existe en el propio repo.
- **`computePurchaseOrderTotal` nunca persiste un total propio, siempre lo deriva de las líneas** (A10) — el patrón a extender a `orders`.
- **Los campos de fecha son consistentemente ISO string, nunca `Date` instanciado** (A11), y existe un helper local-first correcto (`toISODateString`) ya usado en la mayoría de los lugares — el bug ALTO #8 es la única excepción real a un patrón por lo demás sólido.

## Preguntas abiertas que conviene resolver antes de Fase B/C

Consolidado de las preguntas que aparecen en múltiples auditorías o que bloquean una decisión de ADR:

1. **Representación de dinero** (A10#1, insumo de ADR futuro no listado explícitamente en el prompt maestro pero necesario antes de Tanda 8) — entero en centavos vs. decimal-string. Sin esto, ALTO #6/#7 y MEDIO #19 no se pueden cerrar.
2. **`clientId` real en Order/Delivery/CashTransaction** (A4#1, ALTO #3) — insumo directo de ADR-001 (entrega parcial) y ADR-006 (IDs tipados): una entrega no puede mostrar el historial del cliente sin esto.
3. **Corte de "vencido"/"período"**: ¿medianoche calendario o instante exacto? (A11, MEDIO #20/#21) — decisión de negocio, no solo técnica.
4. **¿Se ejecutan ya los checklists de navegador acumulados** (ALTO #10, 5 tandas + Tanda 3e parcial + 3g) **antes de seguir con Fase C**, o se acepta el riesgo y se sigue avanzando? (A14).
5. **Alcance de `compras` (empresa vs. sucursal) y del Dashboard** (A5#3/#4, BAJO #27/#28) — confirmar junto con el resto de los dominios del punto 0 del prompt maestro.
6. **Prioridad de Tanda 3f (Reposición)** (ALTO #1) — es, según A2 y A3, el hallazgo de volumen más urgente de toda la ronda porque es el único listado real sin ningún límite de tamaño; y **`analytics`** (ALTO #2) — ¿se le da un service mínimo ya, o se resuelve junto con Tanda 7?

## Siguiente paso según el prompt maestro

Con FASE A completa (14/14 auditorías, 0 bloqueantes), el prompt maestro exige detenerse acá para revisión de Leandro antes de avanzar a FASE B (ADRs). No se ha escrito ningún ADR ni tocado código de aplicación en esta ronda.
