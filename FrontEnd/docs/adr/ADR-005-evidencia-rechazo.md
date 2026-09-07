# ADR-005 — Evidencia del rechazo

**Estado:** Decidido. **Fecha:** 2026-09-07.

## Problema

Tanda 8 (ADR-002) necesita adjuntar evidencia (fotos, PDF) a un evento de rechazo de mercadería. Hay que decidir cómo suben los archivos sin comprometer el tamaño del payload de la operación ni el rendimiento del backend real futuro.

## Opción elegida

- **Subida directa a storage con URL prefirmada.** Flujo: `POST /uploads/sign` (el cliente pide una URL de subida firmada) → el cliente hace `PUT` del archivo directo a esa URL (sin pasar por el backend de la app) → el identificador que devuelve ese flujo se guarda en el evento de rechazo (`evidenciaIds: string[]` o similar), **nunca el archivo en sí**.
- **Nunca base64 dentro del JSON de la operación de rechazo** — el payload de "rechazar esta línea" lleva referencias a archivos ya subidos, no los bytes.
- **Límites explícitos:** máximo 5 archivos por evento, 10 MB cada uno, tipos aceptados `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Si una subida falla, el evento no se envía a medias.** La UI muestra el fallo por archivo individual y permite reintentar SOLO los que fallaron — no se descarta todo el lote ni se envía el evento de rechazo con evidencia incompleta sin que el usuario lo sepa.

## Alternativas descartadas

1. **Multipart directo al backend de la app** (el archivo viaja al mismo backend que procesa el rechazo, que lo reenvía a storage). Descartada: agrega una carga innecesaria al backend de aplicación (proxyea bytes de archivo que no necesita procesar) y no escala igual de bien como la subida directa a storage, que es el patrón estándar para este caso.
2. **Base64 embebido en el JSON de la operación.** Descartada explícitamente por el prompt maestro ("Nunca base64 dentro del JSON de la operación") — infla el payload ~33% sobre el tamaño real del archivo, y mezcla datos binarios con la operación de negocio, dificultando reintentos parciales (si el JSON falla, se pierde todo, no solo un archivo).
3. **Todo o nada en la subida de evidencia** (si un archivo falla, se descarta el lote completo y hay que volver a adjuntar todos). Descartada porque es peor experiencia sin necesidad — el usuario ya subió 4 de 5 archivos con éxito, forzarlo a resubir todos por el que falló es fricción evitable.

## Qué se rompe si se cambia después

- Si se migra a multipart-al-backend después de haber implementado URL prefirmada, hay que rediseñar el flujo de subida completo en el cliente (el componente de subida asume una URL de storage directa, no un endpoint de la app) — no es un cambio menor.
- Si los límites (5 archivos, 10 MB, tipos aceptados) cambian, deben actualizarse en un solo lugar (el módulo de subida compartido) — si se hardcodean por pantalla, hay que auditar cada una.
- Si se relaja "todo o nada" hacia el otro extremo sin cuidado (enviar el evento de rechazo aunque falten archivos, sin avisar), se pierde evidencia silenciosamente — un caso especialmente sensible porque el rechazo es evidencia legal/comercial ante el proveedor.
