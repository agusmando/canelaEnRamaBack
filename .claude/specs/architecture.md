# Arquitectura y contratos técnicos

## Stack y arranque

- Node.js `>=22`, TypeScript `5.9`, Express `5`, PostgreSQL y Prisma `6`.
- Módulos ES; imports relativos TS usan extensión `.js` en el código fuente para resolución Node16.
- Entrada: `src/server.ts`; configuración/middleware HTTP: `src/app.ts`; router de negocio: `src/routes/index.route.ts`, montado bajo `/api`.
- SuperTokens añade su middleware y endpoints de auth bajo `/api/auth`.
- TypeScript estricto, target ES2022, módulo/resolución Node16, salida a `dist`.

## Capas principales

1. **Rutas (`src/routes`)**: método, path, orden y middlewares por endpoint.
2. **Controladores (`src/controllers`)**: interpretan request, invocan servicios y construyen respuesta. `generic-impl.controller.ts` cubre CRUD común.
3. **DTO (`src/dto`)**: tipos/validación/contratos de entrada y salida específicos.
4. **Servicios (`src/services`)**: reglas de negocio y coordinación de transacciones e integraciones.
5. **Repositorios (`src/repository`)**: acceso a Prisma, SQL y recursos externos; CRUD común en `generic.repository.ts`.
6. **Mappings (`src/mappings`)**: lista blanca de campos/relaciones consultables y seleccionables en endpoints genéricos.
7. **Persistencia/SQL (`src/config/prisma`)**: `schema.prisma`, cliente compartido y migraciones; funciones de inventario y carrito viven en migraciones.
8. **Middleware/utilidades**: auth, errores, carga de archivos, vista pública, pricing, filtros y formato de respuestas.

No introducir reglas de negocio en rutas/controladores ni acceso Prisma ad hoc cuando existe servicio/repositorio correspondiente. Mantener el estilo de módulos y separación actual.

## Persistencia y consistencia

- Prisma usa PostgreSQL; `DATABASE_URL` es la conexión de runtime/pooler y `DIRECT_URL` la conexión directa indicada para migraciones.
- Cliente Prisma compartido en `src/config/prisma/client.ts`.
- Las transacciones son esenciales para checkout, cambios de stock, composición de mixes y carritos.
- El stock debe actualizarse mediante `stockMovement.repository` y funciones PostgreSQL versionadas en migraciones. Esto protege contra stock negativo y concurrencia y conserva auditoría.
- Antes de modificar SQL o tipos, revisar schema actual y todas las migraciones posteriores relevantes. No confiar en `src/sql_sp/functions.sql` como fuente consolidada: es una nota/resumen.
- Algunas relaciones de catálogo usan inactivación lógica para conservar historial. Los snapshots de orden son datos históricos; no recalcularlos desde catálogo.
- La base local `docker-data/db` no fue inspeccionada y puede diferir del schema/migraciones versionados.

## Contratos de API

- Router de negocio bajo `/api`; evitar colisiones colocando paths específicos (`/item`, `/me`, `/mine`) antes de rutas `/:id`.
- CRUD genérico: filtros, selecciones y relaciones permitidos están definidos por mappings. Parámetros no mapeados pueden descartarse silenciosamente; al ampliar filtros, modificar mapping y validar su impacto.
- Respuesta habitual `{ statusCode, message, response }`; paginación en `response.content` y `response.pagination`.
- Mapeo esperado de errores: 400 input/validación, 401 sin sesión, 403 rol insuficiente, 404 recurso ausente, 409 conflicto/regla de negocio/SQL, 502 proveedor externo; 500 no debe revelar detalles internos en producción.
- Respetar DTOs, nombres de campos y enums exactos. La especificación de endpoints está en [functional.md](functional.md).

## Autenticación, privacidad y permisos

- SuperTokens maneja sesión, credenciales, proveedores sociales y roles; login/registro sincroniza usuario local (`User.supertokensId`). Google login se configura en el Core de SuperTokens.
- Sesiones pueden llegar por cookie o Bearer según la configuración middleware. CORS tiene credenciales habilitadas; configurar `CORS_ORIGINS` explícitamente en entornos expuestos (sin ella se refleja cualquier origen según el código).
- `verifySession()` protege rutas autenticadas. `attachRoles` adjunta roles y `requireRole` exige acceso. Staff es `ADMIN`/`EMPLOYEE`; ciertas mutaciones solo `ADMIN`.
- Controlar propiedad del recurso dentro del servicio aunque haya sesión válida: carrito, orden, reseña, envío y pago.
- No asumir que `User.role` en Prisma determina permisos: el middleware consulta SuperTokens UserRoles. No se halló gestión local de asignación staff.
- Las vistas públicas de producto/variante ocultan `price`, `profitMargin` y `priceAtTime`; conservar esta protección y evitar filtración indirecta en joins/respuestas anidadas.
- Tracking público evita datos personales. No incluir secretos ni valores de `.env` en logs/documentación.

## Integraciones y límites

- **Cloudinary:** imágenes de producto/variante y banners; Multer en memoria; respetar límites de cantidad/tamaño/tipo y compensar recursos subidos si la transacción falla.
- **Mercado Pago Checkout Pro:** preferencia, consulta/sync de pago y webhook. Consultar al proveedor antes de aceptar estado webhook; validar monto/moneda y firma si el secreto está configurado.
- **Google Places API:** resumen y hasta cinco reseñas por consulta, persistidas en caché con sincronización limitada.
- **SuperTokens:** autenticación, sesiones, Google login y UserRoles.
- **Pixabay:** solo script auxiliar `scripts/seed-images.ts`.
- No hay adaptadores API de transportistas detectados. PedidosYa fue retirado del modelo y no está integrado.
  
## Variables de entorno (nombres solamente)

- App/DB: `PORT`, `NODE_ENV`, `CORS_ORIGINS`, `PRISMA_LOG`, `DATABASE_URL`, `DIRECT_URL`.
- SuperTokens: `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`, `API_DOMAIN`, `WEBSITE_DOMAIN`.
- Cloudinary: `CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Google Places: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`, `GOOGLE_PLACE_QUERY`, `GOOGLE_PLACES_LANGUAGE`.
- Mercado Pago: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `WEB_URL`, `API_PUBLIC_URL`, `MP_STATEMENT_DESCRIPTOR`, `MP_ORDER_TTL_HOURS`, `MP_ALLOW_CASH`.
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` para invitaciones/creación de contraseña, verificación de email y avisos de reintegro. `EMAIL_LOGO_URL` opcional reemplaza el favicon público de marca.
- Auxiliares: `PIXABAY_API_KEY` para script de imágenes; `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` para Docker local; `LOGIN_CREDENTIALS`, `LOGIN_PASSWORD` para `node-fetch.js` (no parte del runtime normal).

El archivo `.env.example` describe configuración de desarrollo. Nunca copiar valores reales a docs, logs o commits; `.env` puede contener secretos.

## Manejo de archivos

- Multer procesa multipart en memoria, rutas deben autorizar antes de aceptar/procesar archivos.
- Producto/variante: campo `image`, máximo 7 ficheros por request según configuración observada.
- Banner: `desktopImage` y `mobileImage`, máximo 5 MB por archivo; JPG, PNG, WEBP, GIF o AVIF.
- Los identificadores públicos de Cloudinary se persisten para poder reemplazar/eliminar medios.

## Comandos / calidad actual

- `npm run dev`: `tsx watch src/server.ts`.
- `npm run build`: Prisma generate y `tsc`.
- `npm start`: inicia `dist/server.js`.
- `npm run seed:images`: tarea auxiliar.
- `npm test`: todavía no implementado; termina con error. No presentar cambios como probados por suite automatizada.
- Despliegue Docker usa Node 22; Render aplica migraciones en predeploy y health check en `/api/health`.
