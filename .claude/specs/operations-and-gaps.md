# Operación, despliegue y brechas conocidas

## Ejecución local

- Requisito de runtime: Node.js `>=22` (también indicado por `.nvmrc`/configuración de despliegue).
- Configurar las variables a partir de `.env.example`, sin compartir secretos.
- `npm run dev`: servidor con recarga mediante `tsx watch`.
- `npm run build`: genera Prisma Client con el schema de `src/config/prisma/schema.prisma` y compila con TypeScript.
- `npm start`: inicia `dist/server.js`.
- `npm run seed:images`: ejecuta `scripts/seed-images.ts`; revisar primero opciones y hacer `dry-run` cuando corresponda.
- `npm test`: no existe suite configurada; comando devuelve “no test specified” y código de error.

## Procesos runtime

- El servidor intenta expirar pedidos impagos al iniciar y después cada 30 minutos. La tarea consulta Mercado Pago antes de cancelar/reintegrar stock.
- El cierre por SIGTERM/SIGINT cierra HTTP y desconecta Prisma.
- Lecturas de reseñas de Google pueden iniciar actualización en segundo plano si el caché excede el TTL observado; hay control de concurrencia y reintento mínimo.

## Despliegue

- Docker construye con Node 22, genera Prisma Client en la etapa de build y arranca Node sobre la salida compilada.
- Render configura predeploy de migraciones y health check en `/api/health`; el manifiesto declara una instancia, dato relevante para el proceso periódico.
- Configurar CORS de forma explícita con `CORS_ORIGINS` en entornos publicados. Cuando falta, el código refleja orígenes, lo que no debe confundirse con una lista restringida.
- Verificar que `DIRECT_URL` sea accesible para migraciones y que `DATABASE_URL` sea apropiada para conexiones de runtime.

## Integraciones externas

| Integración | Uso | Variables principales |
|---|---|---|
| PostgreSQL / Prisma | Datos y transacciones | `DATABASE_URL`, `DIRECT_URL` |
| SuperTokens | Login, sesión, roles | `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`, `API_DOMAIN`, `WEBSITE_DOMAIN` |
| Cloudinary | Medios de productos, variantes y banners | `CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Mercado Pago | Preferencias Checkout Pro, consulta de pagos y webhook | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `WEB_URL`, `API_PUBLIC_URL` y configuración opcional |
| Resend | Invitaciones/creación de contraseña, verificación de email y avisos de reintegro total | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, opcionalmente `EMAIL_LOGO_URL` |
| Google Places | Place y reseñas externas | `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` y parámetros opcionales |
| Pixabay | Búsqueda de imágenes exclusivamente para script auxiliar | `PIXABAY_API_KEY` |

No se incluyen valores de secretos. Ver [arquitectura](architecture.md#variables-de-entorno-nombres-solamente) para lista completa.

## Script de imágenes

`scripts/seed-images.ts` es herramienta operativa separada del servidor. Puede resolver consultas y subir imágenes a Cloudinary para productos/banners, limita el alcance mediante IDs/tipos/límites, soporta modo simulación y mantiene log JSONL para auditoría/undo. `scripts/product-image-queries.json` contiene consultas. Revisar el log y opciones antes de revertir cambios; no tratarlo como una tarea automática de runtime.

## Brechas / dudas que requieren confirmación

1. **Pruebas:** `npm test` no ejecuta tests. Añadir suite y cobertura es una mejora recomendada, especialmente para stock, checkout, descuentos, permisos y webhook.
2. **Asignación de staff:** el middleware usa roles de SuperTokens; no se encontró flujo API backend para asignarlos. Confirmar proceso externo y no abrir endpoints suponiendo que `User.role` es suficiente.
3. **Reembolsos:** el dashboard permite cancelar órdenes pagadas por Mercado Pago con reintegro total y aviso por Resend. Configurar y verificar el remitente en Resend; los reembolsos pendientes/rechazados pueden requerir seguimiento manual en Mercado Pago.
4. **Transportistas:** tracking externo es manual; no afirmar actualización automática por carrier.
6. **Banners:** `ANNOUNCEMENT_BAR` define límite recomendado/DTO de un activo vigente; no se verificó enforcement del servicio.
7. **SQL vigente:** migraciones consecutivas modifican funciones de stock/carrito (incluyendo firma con opción de presentación). Confirmar conjunto aplicado en DB; no usar `src/sql_sp/functions.sql` como fuente autoritativa.
8. **Datos de entorno:** no se auditó contenido de `docker-data/db` ni la DB desplegada; las especificaciones describen código versionado, no estado real de datos.
9. **Carpeta `src/models`:** está vacía según inspección, parece no formar parte de la arquitectura activa.
10. **`node-fetch.js`:** auxiliar que consume `LOGIN_CREDENTIALS`/`LOGIN_PASSWORD`, no listado como script normal del backend; revisar propósito y exposición antes de incorporarlo a flujos.
11. **Fallback de CORS:** ausencia de `CORS_ORIGINS` refleja cualquier origen según código; fijar lista restrictiva para producción.

## Mejoras de contexto/prácticas sugeridas (no son funcionalidades existentes)

- Incorporar tests unitarios/integración y entorno aislado para PostgreSQL; cubrir concurrencia/atomicidad de stock y checkout.
- Generar OpenAPI desde DTO/rutas o mantener una especificación de API versionada que pueda contrastarse automáticamente.
- Añadir verificación en CI para compilar, validar migraciones, formato y cambios en contratos.
- Documentar/provisionar el ciclo seguro de asignación de roles SuperTokens y rotación de credenciales.
- Añadir runbook de conciliación de pagos tardíos/reembolsos, respuesta ante fallos Cloudinary y restauración de base de datos.
- Aclarar contrato de idempotencia para checkout/webhooks y garantizar protección contra duplicados en pruebas.
- Hacer explícita la lista CORS de producción y fallar al arrancar si falta en producción.
