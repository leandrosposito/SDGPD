# ADR-002 — Máquina de estados de la entrega/viaje

**Estado:** Decidido. **Fecha:** 2026-09-07.

## Problema

`Delivery` (`logistics.types.ts`) hoy tiene un `status` de texto con transiciones decididas ad-hoc en cada componente que las dispara (`LogisticsPage.tsx`, `advanceDeliveryStatus`). Sin un mapa único de transiciones válidas, nada impide que un componente nuevo (Tanda 8 agrega reprogramación y rechazo) dispare una transición inválida (ej. de `FINALIZADO` a `EN_TRANSITO`) simplemente porque nadie la prohibió explícitamente en ese punto del código.

## Opción elegida

- **Estados del viaje:** `CREADO → EN_TRANSITO → FINALIZADO`, más `REPROGRAMADO` y `CANCELADO`.
- **Un único mapa tipado en `shared/`** (`shared/types/deliveryStatus.types.ts` o similar, a definir en Tanda 8) con las transiciones válidas, y una función pura `puedeTransicionar(desde: DeliveryStatus, hasta: DeliveryStatus): boolean`. Ningún componente decide una transición por su cuenta — todo `advanceDeliveryStatus`/equivalente llama a esta función antes de aplicar el cambio, y rechaza (sin excepción silenciosa) si la transición no es válida.
- **El rechazo NO es un estado del viaje — es un evento a nivel de LÍNEA.** Un viaje `FINALIZADO` puede tener líneas entregadas, líneas rechazadas parcialmente (cantidad rechazada < cantidad de la línea) y líneas rechazadas por completo. El "rechazo total" es el caso particular donde TODAS las líneas del viaje quedan rechazadas — no es un estado `RECHAZADO` aparte del viaje, es una consecuencia observable de mirar sus líneas.
- **`REPROGRAMADO` guarda:** fecha anterior, fecha nueva, motivo, responsable y timestamp — y el viaje **vuelve a `CREADO`** con la fecha nueva (no queda "parado" en `REPROGRAMADO`; ese estado es transitorio, registra el evento y continúa el ciclo desde `CREADO`).
- **Toda transición genera un evento en el historial** (quién, cuándo, de qué estado a qué estado) — append-only, mismo criterio que ADR-001.

## Alternativas descartadas

1. **Un estado `RECHAZADO` a nivel de viaje.** Descartada porque un viaje con 3 productos donde se rechaza 1 no puede describirse con un solo estado de viaje sin perder información — igual que ADR-001 descartó un `status` de pedido de texto libre por la misma razón. El rechazo es información por línea, igual que la entrega misma.
2. **Transiciones decididas por cada componente que las llama** (el patrón actual). Descartada explícitamente: es la causa raíz del riesgo que este ADR busca cerrar — sin un único punto de verdad, cada nuevo flujo (reprogramación, rechazo) tendría que reinventar qué transiciones son válidas, con alta probabilidad de inconsistencia entre pantallas.
3. **`REPROGRAMADO` como estado persistente** (el viaje se queda ahí hasta que alguien lo reactive a mano). Descartada porque complica el flujo sin necesidad: reprogramar es "este viaje empieza de nuevo con otra fecha", no un estado de espera indefinida — volver a `CREADO` de inmediato, con el evento de auditoría guardado aparte, es más simple y no pierde información (el evento de reprogramación ya registra que ocurrió).

## Qué se rompe si se cambia después

- Si se agrega un estado nuevo sin pasar por el mapa único (ej. un componente que compara `status === 'ALGO'` directo en vez de usar `puedeTransicionar`), se reintroduce exactamente el problema que este ADR resuelve — cualquier tanda futura que toque estados de entrega debe extender el mapa, no bypassearlo.
- Si se decide modelar el rechazo como estado de viaje después de haberlo implementado como evento de línea, hace falta migrar todo el historial existente (los eventos ya grabados no tienen un "estado de viaje" que inventar retroactivamente sin perder precisión) — costoso, no trivial.
- Si `REPROGRAMADO` deja de volver a `CREADO` automáticamente, cualquier código que asuma "después de reprogramar, el viaje vuelve a `CREADO`" (ej. un filtro de "viajes activos") se rompe silenciosamente.
