# Verificación pendiente — checklist unificado

**Armado y verificado contra el código:** 2026-09-30 (sesión `avance-2026-09-30`). Las rutas, etiquetas de botones y números de línea citados abajo se chequearon ese día contra `src/`. Si lo leés bastante después, reverificá antes de confiar (regla 2.10 de `PROTOCOLO.md`).

**Qué es:** todos los puntos de verificación en navegador que **nunca se ejecutaron**, sacados de los 13 checklists de Tandas 0/1, 3a, 3b, 3c, 3d, 3g, 4, 5, 6, 7, 8, ADR-009 y el barrido de `empresaId`. Están deduplicados (cuando dos checklists pedían lo mismo, queda un solo punto que cita los dos orígenes) y ordenados por riesgo, **del más alto al más bajo**.

**Qué NO es:** no reemplaza a los originales, que siguen en `docs/historial/verificaciones/` sin cambios. Cuando corras un punto de acá, anotá el resultado en la tabla del final de este archivo. Si querés, también en el original.

**Criterio de "No ejecutado":** 6 de los 13 originales (0/1, 3a, 3b, 3c, 3d, 3g) tienen tabla de resultados con "No ejecutado" explícito. Los otros 7 (4, 5, 6, 7, 8, ADR-009, sweep) no tienen tabla de resultados. Según `docs/ESTADO.md`, ningún commit dice "confirmado en navegador", así que acá se toman **todos** sus puntos como no ejecutados. De Tanda 0/1 quedan afuera los únicos 2 puntos con resultado ("Verificado (parcial)": 6 y 11). Del punto 6 se conserva la mitad que no se probó.

**Fuera de este archivo:** los checklists de Tandas 2, 2.5, 3e, 3f, 9, 10A, 10B, 11, 12, 13, 14, 15, 16, B, C1 y C2, y los 2 de la sesión 2026-09-30 (`VERIFICACION_2026-09-30_T2_lotes.md`, `VERIFICACION_2026-09-30_T4_reposicion.md`), tampoco tienen evidencia de haberse corrido, pero no estaban en la lista de esta tarea. Siguen pendientes en su archivo original.

**Preparación común:** `npm run dev` desde `FrontEnd/`, y hard refresh (Ctrl+Shift+R) antes de empezar. Para los escenarios de latencia, fallo o debug: copiá el bloque que corresponda de `FrontEnd/.env.local.ejemplo-verificacion` a `FrontEnd/.env.local`, **reiniciá el servidor** (Vite lee `.env*` una sola vez al arrancar) y recargá. El mock vive en memoria: **F5 lo resetea**. Donde un punto pida "no recargar", es literal.

---

## Nivel 1 — Flujos de Compras que antes no compilaban

Riesgo más alto: antes del barrido de `empresaId` (2026-09-08) `tsc` ni siquiera compilaba estos archivos. Hoy compilan, pero nadie los ejecutó nunca con la firma nueva.

### P-01. Compras: alta de orden (borrador y emitida)
- **Pasos:** `/compras` → "Nueva Orden de Compra" → cargá proveedor, sucursal y al menos un producto con cantidad y precio → "Guardar Borrador". Después repetí con otra orden y "Emitir Orden de Compra".
- **Esperado:** la primera aparece en el listado como **Borrador** y la segunda como **Enviada**. En los dos casos hay toast de éxito y no hay errores en consola.
- **Origen:** `VERIFICACION_2026-09-08_empresaid-sweep.md` §1.

### P-02. Compras: transición de estado y recepción
- **Pasos:** con una orden **Enviada** (la de P-01), andá a la tab "Pendientes de Recepción" y marcala como recibida (o la transición que ofrezca). Después abrí el detalle de otra orden desde el listado general y aplicá una transición válida.
- **Esperado:** la orden sale de "Pendientes", aparece el toast de éxito y el estado nuevo se ve en el listado sin F5.
- **Origen:** `VERIFICACION_2026-09-08_empresaid-sweep.md` §2.

### P-03. Reposición: "Generar OC" desde una sugerencia
- **Pasos:** `/inventario` → tab **Reposición** → "Generar OC" sobre una sugerencia cuyo producto tenga proveedor válido.
- **Esperado:** se crea la orden, aparece el toast de éxito y el botón no queda trabado en "Generando...". Si el producto no tiene proveedor válido, aparece un toast de error con el motivo y no se crea nada.
- **Origen:** `VERIFICACION_2026-09-08_empresaid-sweep.md` §3.

### P-04. Proveedores: historial de compras en el panel de detalle
- **Pasos:** `/proveedores` → "Ver detalle" de un proveedor con órdenes → tab "Historial y Deuda".
- **Esperado:** carga la lista de órdenes de compra de ese proveedor, sin error.
- **Origen:** `VERIFICACION_2026-09-08_empresaid-sweep.md` §4.

### P-05. Deep-links hacia Compras (desde Proveedores y desde Bajo Stock) sin basura en la URL
- **Pasos:** (a) `/proveedores` → "Ver detalle" de Las Marías → "Nueva OC". (b) `/inventario` → Bajo Stock Mínimo → "Generar OC" en una fila. En los dos casos, mirá la barra de direcciones después de que abra el modal.
- **Esperado:** (a) navega a `/compras` con el modal abierto y **"Las Marías S.A.C.I." ya preseleccionado**, no "Seleccionar proveedor...". (b) El modal abre con la línea del producto precargada. En los dos casos, los parámetros `proveedor` / `producto` / `sucursal` **desaparecen** de la URL una vez abierto el modal.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #10 · `VERIFICACION_TANDA_4.md` #14, #15, #16.

### P-06. Compras: parámetros inválidos pegados a mano en la URL
- **Pasos:** estando en `/compras`, pegá `?producto=inv-001&sucursal=sucursal-invalida`. Después probá `?oc_branch=cualquier-cosa`.
- **Esperado:** la pantalla no se rompe ni queda en blanco. En consola aparece un `console.warn` por el valor inválido. El modal abre sin sucursal preseleccionada o se comporta como si no hubiera parámetro, y el listado descarta el filtro inválido.
- **Origen:** `VERIFICACION_TANDA_5.md` #9, #10.

---

## Nivel 2 — ErrorBoundary, timeout, reintentos y cancelación

Este código está en producción y nunca se ejercitó (`PENDIENTES.md` #5, severidad Media-Alta).

### P-07. El boundary por ruta atrapa un error de render
- **Pasos:** en `src/modules/orders/OrdersPage.tsx`, justo debajo de `export const OrdersPage: FC = () => {` (**línea 69 hoy**; el original decía línea 54 y quedó viejo), agregá `throw new Error('prueba boundary');`. Guardá (HMR, sin reiniciar) y andá a `/pedidos`.
- **Esperado:** en el área de contenido aparece un recuadro con ícono de alerta, **"Ocurrio un error al mostrar esta pantalla."** / "Intenta de nuevo o volve al inicio." y los botones **"Reintentar"** y **"Volver al inicio"**. Una pantalla en blanco total o el overlay de error de Vite es un fallo real.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #1.

### P-08. Con el error puesto, el resto de la app sigue viva
- **Pasos:** con el `throw` de P-07 todavía puesto, usá el Sidebar y el Header (tipeá en el buscador) y navegá a Dashboard o Clientes.
- **Esperado:** Sidebar y Header responden, y la otra pantalla se ve normal. Si se cae todo el layout, se disparó el boundary global de `AppRoutes.tsx` y no el de `AppShell.tsx`: es un error de arquitectura.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #2.

### P-09. "Reintentar" resetea sin recargar la página
- **Pasos:** con el `throw` puesto, en `/pedidos` dejá texto tipeado en el buscador del Header y hacé click en "Reintentar".
- **Esperado:** el fallback vuelve a aparecer (el error sigue en el código), **sin recarga de página**: el texto del Header sigue ahí y no hay parpadeo blanco.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #3.

### P-10. Navegar limpia el error (en dos pasadas)
- **Pasos:** (1) con el `throw` puesto, andá a Inventario y volvé a Pedidos. (2) Sacá el `throw`, guardá, andá a Inventario y volvé a Pedidos **sin F5**.
- **Esperado:** (1) Inventario se ve normal y Pedidos vuelve a mostrar el fallback. (2) Pedidos muestra la tabla normal. Si sigue en fallback, el `resetKey` atado al pathname no funciona.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #4.

### P-11. `logError` con formato en consola
- **Pasos:** con el `throw` puesto, abrí la consola, hacé F5 en `/pedidos`. **Al terminar, sacá el `throw`** y confirmá con `git diff` que `OrdersPage.tsx` quedó igual que antes.
- **Esperado:** un `console.error` con prefijo **`[SDGPD]`** y un objeto con `message` ("prueba boundary"), `stack`, `context.componentStack` y `timestamp` ISO.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #5.

### P-12. Latencia alta: se ve `LoadingState`
- **Pasos:** Escenario B (`VITE_MOCK_LATENCY_MS=3000`), reiniciá el servidor y recargá `/proveedores`.
- **Esperado:** durante ~3 s se ve un spinner centrado con el texto **"Cargando proveedores..."**, no filas grises de skeleton.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #7.

### P-13. Fallo forzado: `ErrorState`, y el reintento funciona
- **Pasos:** Escenario C (`VITE_MOCK_FAILURE_RATE=1`, `VITE_API_DEBUG=true`), reiniciá y recargá `/proveedores`. Cuando aparezca el error, pasá `VITE_MOCK_FAILURE_RATE=0`, reiniciá el servidor **sin recargar la pestaña** y hacé click en "Reintentar".
- **Esperado:** primero aparece **"No se pudo cargar el listado de proveedores."** con el botón "Reintentar". Después del click, la tabla carga.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #8.

### P-14. Dos reintentos con backoff y el mismo req-id
- **Pasos:** Escenario C de nuevo, con la consola abierta **antes** de recargar `/proveedores`.
- **Esperado:** para un mismo `N`, `[httpClient] req-N start` → `retry {attempt:1, afterMs:300, causeCode:'SERVER_ERROR'}` → `retry {attempt:2, afterMs:600, ...}` → `error {attempt:2, status:503, ...}`. El segundo intervalo se ve más largo que el primero. Es un fallo real si hay más de 2 `retry`, si aparece un `causeCode` que no sea red/5xx/timeout, o si el `N` cambia entre líneas. **Al terminar, volvé a `VITE_MOCK_FAILURE_RATE=0`.**
- **Origen:** `VERIFICACION_TANDA_0_1.md` #9.

### P-15. Tipear rápido cancela requests viejos
- **Pasos:** Escenario D (`VITE_MOCK_LATENCY_MS=3000`, `VITE_API_DEBUG=true`). Esperá la primera carga de `/proveedores` y tipeá "arcor" rápido en el buscador.
- **Esperado:** varias líneas `req-N start`, y **solo la última** llega a `resolved`. Las anteriores muestran `req-N cancelled` (no `error`). **Al terminar, volvé al Escenario A.**
- **Origen:** `VERIFICACION_TANDA_0_1.md` #12.

---

## Nivel 3 — Persistencia de Pedidos y Caja (`PENDIENTES.md` #8)

### P-16. Crear un pedido con el buscador de clientes
- **Pasos:** `/pedidos` → "Nuevo Pedido". Revisá que el campo Cliente sea un buscador ("Buscar por razón social o CUIT..."). Tipeá "Almacen" y elegí uno de la lista (hasta 8 resultados). Probá "Cambiar" y volvé a elegir. Con cliente elegido pero sin productos, fijate el botón. Agregá un producto y la dirección, y hacé click en "Confirmar Pedido".
- **Esperado:** después de elegir, el cliente se ve como chip con nombre y CUIT. "Cambiar" vuelve al buscador sin perder el resto del formulario. "Confirmar Pedido" está **deshabilitado** sin cliente. Al confirmar hay toast de éxito y el pedido aparece sin F5 con estado Pendiente y número **`PED-XXXXXX` (6 dígitos, correlativo, ADR-014)**. El original decía `PED-XXXXX` y quedó viejo. Su detalle muestra el cliente real.
- **Origen:** `VERIFICACION_TANDA_3A.md` #3 · `VERIFICACION_TANDA_5.md` #1, #2, #3, #6, #7, #8.

### P-17. Alerta de cliente excedido derivada del dato real
- **Pasos:** en "Nuevo Pedido", elegí "Kiosco El Paso (Excedido)" y después "Almacen La Esquina".
- **Esperado:** con el primero aparece la alerta roja "Cliente Excedido". Con el segundo, no.
- **Origen:** `VERIFICACION_TANDA_5.md` #4, #5.

### P-18. **El pedido creado sobrevive a navegar afuera y volver**
- **Pasos:** con el pedido de P-16 visible, andá a Dashboard y volvé a Pedidos, **sin F5**.
- **Esperado:** el pedido sigue en la tabla. Si desaparece, es el hallazgo más importante de este bloque.
- **Origen:** `VERIFICACION_TANDA_3A.md` #4.

### P-19. Caja: crear movimiento, con totales actualizados
- **Pasos:** `/caja` → "+ Nuevo Movimiento", completalo y hacé click en "Guardar y Cerrar". Repetí con "Guardar y Cargar Otro". En el modal, mirá el campo "Fecha y Hora".
- **Esperado:** el movimiento aparece arriba de todo en el Libro Diario sin F5, e Ingresos / Egresos / Saldo Actual lo reflejan. "Guardar y Cargar Otro" deja el modal abierto con el formulario limpio (salvo tipo y categoría). La hora viene precargada en 24 h (`HH:mm`, sin AM/PM) y la que queda en la tabla es la que pusiste.
- **Origen:** `VERIFICACION_TANDA_3B.md` #3, #6.

### P-20. **El movimiento de Caja sobrevive a navegar afuera y volver**
- **Pasos:** con el movimiento de P-19 visible, andá a Dashboard y volvé a Caja, **sin F5**.
- **Esperado:** el movimiento sigue ahí y los totales lo siguen reflejando.
- **Origen:** `VERIFICACION_TANDA_3B.md` #4.

### P-21. Caja: saldos y "Análisis de Gastos" cierran
- **Pasos:** anotá Saldo Inicial, Ingresos, Egresos y Saldo Actual, y sumá a mano las filas del Libro Diario.
- **Esperado:** Saldo Inicial = $50.000; Ingresos y Egresos coinciden con la suma de las filas de cada tipo; Saldo Actual = Inicial + Ingresos − Egresos. Las categorías de "Análisis de Gastos" salen de los egresos reales. El "+20% vs mes anterior" es fijo desde antes y **no es bug**. El listado carga ordenado por hora descendente, con paginación y **sin** buscador (nunca lo tuvo).
- **Origen:** `VERIFICACION_TANDA_3B.md` #1, #2.

### P-22. Pedidos: avanzar estado y cancelar (**regla actualizada**)
- **Pasos:** en un pedido Pendiente, "Ver detalle" → avanzá de estado hasta Facturado. Después probá "Cancelar" en pedidos de distintos estados.
- **Esperado:** la secuencia es Pendiente → Preparando → Despachado → Entregado → Facturado, reflejada en el panel y en la fila. Facturado no tiene botón para avanzar. **Cancelar ya NO funciona "siempre"**, como decía el original (quedó viejo): desde Tanda 12 se rechaza en `delivered`/`invoiced`/`cancelled`, y desde Tanda 9 también si el pedido tiene una entrega activa. En esos casos el botón no aparece (`OrderDetailPanel.tsx#canCancel`).
- **Origen:** `VERIFICACION_TANDA_3A.md` #6 (corregido con ESTADO.md, Tandas 9 y 12).

### P-23. Pedidos: listado, búsqueda y filtros server-side
- **Pasos:** `/pedidos`. Buscá "esquina" en Cliente. En Estado probá "Preparando", "Facturado" y "Cancelado". Probá también Vendedor ("Gonzalez, Maria") y Forma de Pago.
- **Esperado:** los 6 pedidos del mock (más los que hayas creado), con paginación. "esquina" deja 2 (Almacen La Esquina). Preparando → PED-00390, Facturado → Despensa Los Pinos, Cancelado → Maxikiosco Norte. Los KPIs de arriba **no** cambian con el filtro de estado, pero **sí** con búsqueda, vendedor, pago y fecha (es intencional).
- **Origen:** `VERIFICACION_TANDA_3A.md` #1, #2.

---

## Nivel 4 — Entregas (Logística)

**Aviso de vigencia:** los checklists de Tanda 8 y del barrido son anteriores a Tanda 9 (3 ejes de estado), 10B (viajes) y 11/13 (reprogramación y Paradas). Las etiquetas de los botones se verificaron hoy (`DeliveriesTable.tsx:97-111`: "En ruta", "Registrar entrega", "Reprogramar"), pero lo que pasa con el estado después pudo haber cambiado. Si algo no coincide, contrastalo con `VERIFICACION_TANDA_9.md`, `VERIFICACION_TANDA_11.md` y `VERIFICACION_TANDA_13.md` antes de reportarlo como bug.

### P-24. Entrega "Creada" → "En Ruta"
- **Pasos:** `/logistica`, en una entrega Creada → "En ruta".
- **Esperado:** badge azul "En Ruta", toast de confirmación y la lista se refresca sola.
- **Origen:** `VERIFICACION_TANDA_8.md` #1 · `VERIFICACION_2026-09-08_empresaid-sweep.md` §6.1.

### P-25. Registrar una entrega completa
- **Pasos:** en una entrega En Ruta → "Registrar entrega", confirmar con los valores por defecto.
- **Esperado:** el modal muestra las columnas Pedida / Entregada / Pendiente / Entregar ahora / Rechazar ahora / Motivo. La entrega pasa a Finalizada y el pedido asociado actualiza su estado de cumplimiento.
- **Origen:** `VERIFICACION_TANDA_8.md` #2 · `VERIFICACION_2026-09-08_empresaid-sweep.md` §6.3.

### P-26. Entrega parcial con rechazo y evidencia
- **Pasos:** en otra entrega En Ruta, en una línea poné "Entregar ahora" menor al pendiente y el resto en "Rechazar ahora" con motivo. Adjuntá 1 o 2 imágenes o PDF chicos. Si uno sale en rojo (falla determinística, 1 de cada 8), hacé click en reintentar solo en ese. Intentá también adjuntar un archivo que no sea imagen ni PDF, o uno de más de 10 MB. Por último, abrí el pedido asociado.
- **Esperado:** aparece "Adjuntar evidencia" y cada archivo termina con check verde. El reintento afecta solo a ese archivo. El archivo inválido se rechaza con un mensaje, sin subirse. La entrega queda Finalizada igual. En el pedido, la cantidad entregada de esa línea subió **lo que cargaste**, no lo pedido.
- **Origen:** `VERIFICACION_TANDA_8.md` #3, #4, #5, #6.

### P-27. Reprogramar
- **Pasos:** en una entrega Creada o En Ruta → "Reprogramar". Intentá confirmar sin motivo y después con motivo.
- **Esperado:** sin motivo aparece un error. Con motivo, vuelve a "Creada" con la fecha nueva. Desde Tanda 11 el motivo es un dropdown del catálogo, no texto libre.
- **Origen:** `VERIFICACION_TANDA_8.md` #7 · `VERIFICACION_2026-09-08_empresaid-sweep.md` §6.2.

### P-28. Historial y máquina de estados
- **Pasos:** abrí el historial (reloj) de una entrega reprogramada y de una registrada. Mirá los botones de una entrega Finalizada o Cancelada.
- **Esperado:** en el historial se ven las transiciones con quién y cuándo, la sección de reprogramaciones (motivo, fecha anterior y nueva) y la sección de Remitos. Una Finalizada o Cancelada **solo** tiene "Ver historial".
- **Origen:** `VERIFICACION_TANDA_8.md` #8, #9 · `VERIFICACION_2026-09-08_empresaid-sweep.md` §6.4.

### P-29. Polling cada 30 s, y sin polling en segundo plano
- **Pasos:** dejá `/logistica` abierta con DevTools (Network, o `VITE_API_DEBUG=true`) durante 30 s o más. Después cambiá de pestaña del navegador otros 30 s o más.
- **Esperado:** en primer plano aparece un refetch nuevo con los mismos filtros. En segundo plano, **ninguno**.
- **Origen:** `VERIFICACION_TANDA_8.md` #10.

---

## Nivel 5 — Alcance por sucursal y estado en la URL

### P-30. Movimientos e Historial filtran por sucursal, con conjuntos disjuntos
- **Pasos:** `/inventario` → Movimientos: anotá SKU y fechas en Centro, y cambiá a Norte y a Sur. Repetí en Historial del Producto.
- **Esperado:** cada sucursal muestra otros registros, y ninguno de Centro reaparece en Norte o Sur. Las dos tabs cargan, paginan y ordenan (Movimientos por Fecha / Producto / Cant.; Historial busca con ~300 ms de debounce y ordena por Fecha / Producto).
- **Origen:** `VERIFICACION_TANDA_3G.md` A1, B1, C1, C2.

### P-31. Cambiar de sucursal no muestra ni un frame de datos viejos
- **Pasos:** en Bajo Stock Mínimo, Movimientos, Historial, Stock Actual y Logística, anotá el primer dato y cambiá de sucursal.
- **Esperado:** puede verse carga o skeleton, pero **nunca** el dato anterior bajo el rótulo de la sucursal nueva.
- **Origen:** `VERIFICACION_TANDA_4.md` #5, #6, #7.

### P-32. Los listados de alcance empresa NO cambian al cambiar de sucursal
- **Pasos:** con Proveedores, Pedidos y Caja cargados, cambiá de sucursal.
- **Esperado:** mismas filas y sin parpadeo de recarga. Es el comportamiento correcto.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #13 · `VERIFICACION_TANDA_3A.md` #5 · `VERIFICACION_TANDA_3B.md` #5.

### P-33. Estado de los listados en la URL, reproducible con F5
- **Pasos:** en cada uno de los 15 listados (tabla de prefijos en `VERIFICACION_TANDA_4.md` §3) cambiá página, búsqueda, orden y filtros. Copiá la URL, abrila en una pestaña nueva y después volvé a página 1.
- **Esperado:** cada cambio aparece como parámetro con su prefijo (`oc_`, `bajo_`, `mov_`, etc.). Pegar la URL reproduce **exactamente** el mismo estado, y `page=1` no queda en la URL.
- **Origen:** `VERIFICACION_TANDA_4.md` #8-#13.

### P-34. Selector de sucursal con 0 / 1 / N sucursales
- **Pasos:** con N=3, abrilo con teclado (flecha abajo, Escape) y con mouse. Para 1 y 0, editá temporalmente el mock de sesión (`src/data/mock/session.mock.ts`) y **revertilo** al terminar.
- **Esperado:** con 3 es un dropdown funcional. Con 1 es una etiqueta estática sin flecha. Con 0 muestra "Sin sucursales disponibles", sin errores en consola.
- **Origen:** `VERIFICACION_TANDA_4.md` #1-#4.

---

## Nivel 6 — Resto (listados migrados, exportación, tablero)

### P-35. Proveedores: búsqueda y filtro de rubro (la mitad no probada del punto 6)
- **Pasos:** `/proveedores`, buscá "arcor" y después elegí "Golosinas" en el filtro de rubro.
- **Esperado:** en los dos casos queda 1 fila (Arcor), después del debounce.
- **Origen:** `VERIFICACION_TANDA_0_1.md` #6 (solo la parte sin verificar).

### P-36. Directorio de Clientes: listado, búsqueda, filtros, alta, edición y persistencia
- **Pasos:** `/clientes` → Directorio. Buscá con debounce, filtrá por Zona / Vendedor / Estado, creá un cliente (con CUIT real), editá uno, andá a Dashboard y volvé.
- **Esperado:** pagina y filtra server-side. Alta y edición muestran toast y se reflejan sin F5, y el cliente nuevo sigue ahí al volver.
- **Origen:** `VERIFICACION_TANDA_3D.md` A1, A2, A3, B1, B2, B3.

### P-37. Cuentas Corrientes y Morosos siguen igual; el cliente nuevo aparece bien
- **Pasos:** tab Cuentas Corrientes (búsqueda y rango de fecha) y tab Morosos (tramos 1-30 / 31-60 / 61-90 / 90+). Buscá el cliente de P-36.
- **Esperado:** cargan y paginan como antes. El Dashboard sigue mostrando el mismo total vencido. El cliente nuevo aparece en Cuentas Corrientes con saldo $0 y **no** aparece en Morosos.
- **Origen:** `VERIFICACION_TANDA_3D.md` C1, C2, C3 · `VERIFICACION_2026-09-08_empresaid-sweep.md` §5.

### P-38. Configuración: Usuarios y Roles, Suscripción, Auditoría
- **Pasos:** `/settings` → Usuarios y Roles: directorio (5 usuarios, paginado). En la matriz de permisos, activá "Caja" para Vendedor, andá a Dashboard y volvé. Clickeá "Nuevo Usuario", "Password", "2FA", "Guardar Matriz" y "Actualizar Medio de Pago". Después mirá Suscripción → Historial de Cobros y el widget "Registro de Auditoría".
- **Esperado:** el toggle cambia al instante y **persiste** al volver. Los botones decorativos no hacen nada (es intencional). Historial de Cobros tiene 3 facturas, de la más reciente a la más vieja, con paginación. Auditoría muestra 4 entradas, sin paginación.
- **Origen:** `VERIFICACION_TANDA_3C.md` A1-A4, B1, B2, C1.

### P-39. Exportación server-side (job asíncrono) en los 7 listados con export
- **Pasos:** en Proveedores, Cuentas Corrientes, Morosos, Compras, Pendientes de Recepción, Bajo Stock y Entregas: exportá a .xlsx y a .csv, con un filtro aplicado. Probá también con un filtro que deje la lista vacía.
- **Esperado:** el botón se deshabilita y muestra progreso ("Preparando... 0%" → 30/60/90%). Se descarga un archivo real con el **mismo** subconjunto filtrado, y el CSV abre bien con acentos. Con resultado vacío aparece el toast "No hay datos para exportar con los filtros actuales." y no se descarga nada.
- **Origen:** `VERIFICACION_TANDA_6.md` (todo) · `VERIFICACION_TANDA_4.md` #18.

### P-40. Campanita de alertas
- **Pasos:** mirá el badge. Abrí el panel, hacé click en "Cargar más", marcá una alerta como leída, cerrá con Escape y reabrí.
- **Esperado:** el badge muestra solo las no leídas. Los íconos van por tipo, de la más reciente a la más vieja. "Cargar más" no repite alertas y desaparece al final. Marcar una baja el badge en 1. Al reabrir, arranca de la primera página.
- **Origen:** `VERIFICACION_TANDA_7.md` #1-#5.

### P-41. Tablero: agregados, deep-link y alcance por sucursal (ADR-009)
- **Pasos:** en el Dashboard, sección de agregados: fijate que el selector siga al global. Elegí otra sucursal en el selector propio y después "Toda la empresa". Hacé F5 con cada una y volvé a "Seguir sucursal activa". Hacé click en la tarjeta "Pedidos pendientes de preparación".
- **Esperado:** hay 4 tarjetas (Ventas por zona, Pedidos por estado, Cuentas por cobrar vencidas en `Money`, Pendientes de preparación). Con una sucursal propia, la URL tiene `?branch=...`, el selector global **no** cambia y las 2 tarjetas dinámicas cambian (según la tabla de `VERIFICACION_ADR-009.md`). Cuentas por cobrar sigue fija con "Toda la empresa (no se puede filtrar por sucursal)". Con una sucursal puntual aparece la nota de reconciliación ("Los números de esta sucursal pueden no coincidir..."), que desaparece con "Toda la empresa" (`?branch=all`, los 6 pedidos). F5 mantiene la elección. "Seguir sucursal activa" saca el parámetro. La tarjeta lleva a `/pedidos` con el filtro Pendiente ya aplicado. Las secciones previas del Dashboard siguen igual.
- **Origen:** `VERIFICACION_TANDA_7.md` #6, #7, #8 · `VERIFICACION_ADR-009.md` §1-§5 · `VERIFICACION_2026-09-08_empresaid-sweep.md` §7.

### P-42. Regresión general de mutaciones
- **Pasos:** en la misma pasada, fijate que todas las mutaciones de los puntos anteriores (crear pedido, cliente, OC; cambiar estado de OC) refresquen su listado.
- **Esperado:** ninguna mutación deja el listado viejo.
- **Origen:** `VERIFICACION_TANDA_4.md` #17.

---

## Tabla de resultados

| Punto | Resultado | Fecha | Notas |
|---|---|---|---|
| P-01 | No ejecutado | | |
| P-02 | No ejecutado | | |
| P-03 | No ejecutado | | |
| P-04 | No ejecutado | | |
| P-05 | No ejecutado | | |
| P-06 | No ejecutado | | |
| P-07 | No ejecutado | | |
| P-08 | No ejecutado | | |
| P-09 | No ejecutado | | |
| P-10 | No ejecutado | | |
| P-11 | No ejecutado | | |
| P-12 | No ejecutado | | |
| P-13 | No ejecutado | | |
| P-14 | No ejecutado | | |
| P-15 | No ejecutado | | |
| P-16 | No ejecutado | | |
| P-17 | No ejecutado | | |
| P-18 | No ejecutado | | |
| P-19 | No ejecutado | | |
| P-20 | No ejecutado | | |
| P-21 | No ejecutado | | |
| P-22 | No ejecutado | | |
| P-23 | No ejecutado | | |
| P-24 | No ejecutado | | |
| P-25 | No ejecutado | | |
| P-26 | No ejecutado | | |
| P-27 | No ejecutado | | |
| P-28 | No ejecutado | | |
| P-29 | No ejecutado | | |
| P-30 | No ejecutado | | |
| P-31 | No ejecutado | | |
| P-32 | No ejecutado | | |
| P-33 | No ejecutado | | |
| P-34 | No ejecutado | | |
| P-35 | No ejecutado | | |
| P-36 | No ejecutado | | |
| P-37 | No ejecutado | | |
| P-38 | No ejecutado | | |
| P-39 | No ejecutado | | |
| P-40 | No ejecutado | | |
| P-41 | No ejecutado | | |
| P-42 | No ejecutado | | |

## Mapa de trazabilidad: punto original → punto unificado

Sirve para comprobar que no se perdió ninguno.

| Original | Unificado |
|---|---|
| 0/1 #1, #2, #3, #4, #5 | P-07, P-08, P-09, P-10, P-11 |
| 0/1 #6 (búsqueda y rubro, sin verificar) | P-35 |
| 0/1 #7, #8, #9 | P-12, P-13, P-14 |
| 0/1 #10 | P-05 |
| 0/1 #12, #13 | P-15, P-32 |
| 3A #1, #2 / #3 / #4 / #5 / #6 | P-23 / P-16 / P-18 / P-32 / P-22 |
| 3B #1, #2 / #3, #6 / #4 / #5 | P-21 / P-19 / P-20 / P-32 |
| 3C A1-A4, B1, B2, C1 | P-38 |
| 3D A1-A3, B1-B3 / C1-C3 | P-36 / P-37 |
| 3G A1, B1, C1, C2 | P-30 |
| 4 #1-#4 / #5-#7 / #8-#13 / #14-#16 / #17 / #18 | P-34 / P-31 / P-33 / P-05 / P-42 / P-39 |
| 5 #1-#3, #6-#8 / #4, #5 / #9, #10 | P-16 / P-17 / P-06 |
| 6 (todo) | P-39 |
| 7 #1-#5 / #6-#8 | P-40 / P-41 |
| 8 #1 / #2 / #3-#6 / #7 / #8, #9 / #10 | P-24 / P-25 / P-26 / P-27 / P-28 / P-29 |
| ADR-009 §1-§5 | P-41 |
| sweep §1 / §2 / §3 / §4 / §5 / §6 / §7 | P-01 / P-02 / P-03 / P-04 / P-37 / P-24, P-25, P-27, P-28 / P-41 |
