# Especificación funcional

## 1. Propósito y alcance

El backend implementa la API REST del e-commerce Canela en Rama: catálogo, inventario, promociones, carrito, órdenes, cobros, envíos, reseñas y contenido de tienda. Esta especificación fue compilada mediante lectura estática; no inspecciona datos ni configuración secreta de entornos desplegados. Los endpoints de negocio se montan bajo `/api`; SuperTokens agrega sus propios endpoints de autenticación en `/api/auth`.

## 1.1 Mapa de código por funcionalidad

Usar estas ubicaciones como punto de entrada para contrastar o modificar reglas:

| Área | Código principal |
|---|---|
| Montaje API y servidor | `src/server.ts`, `src/app.ts`, `src/routes/index.route.ts` |
| Catálogo y variantes | `src/routes/product.route.ts`, `src/routes/product-variant.route.ts`, `src/services/product.service.ts`, `src/services/product-variant.service.ts` |
| Precio y ofertas | `src/utils/pricing.ts`, `src/services/pricing.service.ts`, `src/services/offer.service.ts` |
| Inventario y producción | `src/services/stockMovement.service.ts`, `src/repository/stockMovement.repository.ts`, `src/config/prisma/migrations/` |
| Carrito y checkout | `src/services/cart.service.ts`, `src/services/order.service.ts`, `src/repository/cart.repository.ts` |
| Pagos | `src/services/payment.service.ts`, `src/config/mercadopago.ts`, `src/routes/payment.route.ts` |
| Envíos | `src/services/shipment.service.ts`, `src/dto/shipment/shipment.dto.ts` |
| Reseñas | `src/services/review.service.ts`, `src/services/google-review.service.ts` |
| Banners y medios | `src/services/banner.service.ts`, `src/services/image.service.ts`, `src/middleware/fileUploader.ts` |
| Autorización | `src/middleware/auth.middleware.ts`, `src/config/supertokens/` |
| Esquema persistido | `src/config/prisma/schema.prisma` y migraciones posteriores relevantes |

## 2. Actores y acceso

- **Público:** sin sesión. Incluye visitantes y consultas de catálogo/contenido.
- **Sesión opcional:** permite visitante o usuario y adjunta los roles si existe sesión; se usa, entre otros, para catálogo/carrito.
- **Autenticado:** requiere sesión SuperTokens. El servicio puede validar propiedad del recurso además del middleware.
- **Staff:** requiere rol SuperTokens `ADMIN` o `EMPLOYEE`.
- **Admin:** requiere rol SuperTokens `ADMIN`.

Los roles que protege el middleware son de SuperTokens UserRoles. No asumir que el campo `User.role` de Prisma concede permisos. Ver [arquitectura](architecture.md#autenticación-y-autorización).

## 3. Catálogo y administración

### Productos, variantes y taxonomía

- Productos se asocian a una categoría, marca, medida, etiquetas y variantes; una variante representa una presentación vendible.
- Producto y variante tienen activación separada. Al retirar variantes asociadas, se desactivan para conservar historial, en lugar de borrar físicamente.
- Categorías, etiquetas y marcas pueden consultarse públicamente y administrarse por staff. La vinculación de productos a marcas es exclusiva de admin. Proveedores se administran por staff y mantienen relación de muchos a muchos con marcas.
- Variantes concentran costo, margen, inventario, medidas, opciones de paquete, disponibilidad web, umbral, tiempo de solicitud y fotos.
- El middleware de vista pública retira recursivamente `price`, `profitMargin` y `priceAtTime` para usuarios no staff; no confundir esos campos con precio final.
- Productos/variantes aceptan carga multipart de hasta 7 archivos `image` por solicitud, subidos a Cloudinary. Si falla la operación se intenta compensar eliminando medios cargados.

### Precio, ofertas y mixes

- Precio final: costo × (1 + margen), redondeado hacia arriba al múltiplo configurado por `roundingOption`; para `KG`, el precio se interpreta por kilo.
- Se soportan ofertas de porcentaje, importe fijo, compra X paga Y, compra X obtiene Y adicional, porcentaje desde cierta cantidad e importe fijo desde cierta cantidad.
- La oferta debe apuntar exactamente a un producto o variante, tener vigencia válida y respetar rangos/tipos; puede tener umbral mínimo de stock. Se priorizan ofertas de variante sobre las de producto; entre candidatas de un ámbito se prioriza el ID más reciente/mayor, según la lógica del servicio.
- Mixes se componen de variantes mediante dependencias con cantidades. La producción descuenta los componentes y registra la producción del mix; el recálculo de costo/precio puede propagarse a otros mixes. Hay detección/límite de ciclos.
- `availablePedidosYa` es solamente un indicador; no se encontró integración API con PedidosYa.

## 4. Inventario

- Tipos de movimiento: entradas (`IN`), salidas (`OUT`), ajustes (`ADJUSTMENT`), devoluciones (`RETURN`) y producción (`PRODUCTION`).
- La API de movimiento manual solo admite `IN`, `OUT`, `ADJUSTMENT` y `RETURN`; `PRODUCTION` se usa por el flujo interno de mixes.
- Los cambios de stock pasan por funciones PostgreSQL/repositorios que crean auditoría y previenen stock negativo bajo concurrencia. No mutar `currentStock` directamente desde lógica de aplicación.
- Diferencia entre ajuste absoluto y delta: un stock absoluto produce un movimiento de ajuste por la diferencia; `stockIncrement` representa un delta.
- El stock de componentes de mixes se consume al fabricar y se repone en cancelación/devolución de pedidos mediante movimientos correspondientes.

## 5. Carritos y checkout

- `POST /cart` puede iniciar un carrito de invitado o de usuario. Para invitados usa cookie HTTP-only `guest_cart_id` (SameSite Lax, duración máxima observada de 10 días); `GET /cart/me` recupera el carrito de la identidad disponible.
- Las líneas se identifican por carrito, variante y presentación (`selectedBulkOption`), permitiendo varias presentaciones de la misma variante. Cero representa venta suelta; positivo, cantidad de paquetes. Si corresponde y no se especifica presentación, se selecciona la menor disponible.
- Actualizar el carrito permite las operaciones de añadir/fijar cantidad, quitar línea, vaciar y fusionar carrito invitado al usuario autenticado. La fusión usa al usuario de sesión, no un ID de destino arbitrario del body.
- El carrito calcula cotización, descuentos, total, disponibilidad y suficiencia de stock; la identidad y control de propiedad se validan en el servicio.
- `POST /order` requiere usuario autenticado y acepta ítems directos o creación `fromCart`. La transacción lee el carrito propio, bloquea/descarga stock, crea orden con snapshots y vacía carrito de forma atómica.
- Checkout ajusta el surtido al stock real: puede reducir paquetes del tamaño pedido e intentar presentaciones menores; si no hay stock cancela la línea. Si todas las líneas se cancelan, falla la creación.
- Las líneas de orden almacenan snapshots de nombre, variante, precio, descuento y oferta para que cambios posteriores del catálogo no alteren compras históricas.

## 6. Órdenes, estados y devoluciones

- Estados operativos de orden: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`. Las transiciones válidas están centralizadas en el servicio de órdenes.
- Cliente consulta sus órdenes y puede cancelar solamente una propia en `PENDING`; se rechaza si el pago está `APPROVED` o `IN_PROCESS`.
- Staff puede listar y administrar órdenes, cambiar estados y editar líneas según reglas de servicio.
- Las líneas admiten `FULFILLED`, `AWAITING_STOCK`, `PARTIALLY_RETURNED`, `CANCELLED` y `RETURNED`; se gestionan devoluciones parciales/completas y ajuste proporcional del descuento.
- Si todas las líneas quedan cerradas se cancela la orden según la lógica de negocio. Cancelar puede devolver stock; una orden cancelada con envío no finalizado también cancela el envío.
- El estado de orden no es el estado de pago ni el de envío; mantenerlos separados.

## 7. Pagos

- Métodos aceptados por la aplicación: `CASH`, `TRANSFER`, `MERCADOPAGO`. Mercado Pago se habilita con credenciales configuradas; efectivo y transferencia se coordinan manualmente.
- Integración Mercado Pago Checkout Pro: se crea preferencia de pago para una orden, el cliente completa checkout y la aplicación procesa webhook y/o sincronización al regresar.
- Webhook: valida firma cuando hay secreto configurado y vuelve a consultar el pago al proveedor antes de aplicar el estado; no confiar exclusivamente en el payload recibido.
- Los estados del proveedor se normalizan a `PaymentStatus`. Un importe/moneda que no coincide queda `IN_PROCESS` para revisión. Un pago aprobado válido puede avanzar una orden pendiente a `PROCESSING`.
- Se impiden pagos duplicados en estados aprobados/en revisión. Una tarea periódica revisa órdenes impagas y consulta Mercado Pago antes de cancelar/liberar stock.
- Para cancelar una orden pagada con Mercado Pago, el staff puede solicitar el reintegro total desde el dashboard. Se registra el estado del reintegro, se repone stock y se avisa al cliente por Resend; los reintegros pendientes o fallidos requieren seguimiento operativo.
- Pago de efectivo/transferencia y otros métodos offline queda pendiente para gestión manual del staff.
- Correos de invitación/creación de contraseña, verificación y reintegro usan una plantilla cordial en español, logo público y versión de texto cuando Resend está configurado. No se encontraron avisos automáticos de confirmación de pedido ni de cambios de envío.

## 8. Envíos y retiros

- Cada orden puede tener un único `Shipment`; método `DELIVERY` o `PICKUP`, tracking interno `CER-...`, datos de destinatario, costo, ETA y eventos históricos.
- La dirección es obligatoria para `DELIVERY`; retiros y entregas tienen transiciones propias. Los estados finales no continúan a otro estado.
- Se actualiza el estado creando eventos (`POST /shipment/:id/events`), no mediante cambio arbitrario desde `PUT /shipment/:id`. Eventos como preparado/listo para retiro, despachado o entregado pueden sincronizar el estado operativo de la orden.
- No hay integración automática con transportistas: el staff carga manualmente proveedor externo, código y URL.
- Tracking público por código expone progreso/eventos sin información personal; consulta de envío asociado a orden exige autenticación y propiedad o rol staff.

## 9. Reseñas y prueba social

### Reseñas de producto

- Una reseña exige una compra entregada de la variante y se limita a una por usuario/variante.
- Rating entero 1–5; título hasta 120 caracteres; comentario y respuesta hasta 1000 caracteres (validaciones definidas en DTO/servicio).
- Crear o editar reinicia el estado a `PENDING`. El autor administra su reseña; staff modera/aprueba/rechaza y puede responder.
- Público ve únicamente aprobadas y un nombre de autor minimizado. Staff puede consultar estados pendientes/rechazados. Se exponen resumen público y estadísticas staff.

### Reseñas de Google

- Places API devuelve como máximo cinco reseñas por consulta; el backend conserva reseñas y resumen del lugar en caché local.
- Lectura pública puede iniciar sincronización asíncrona si el caché excede 24 horas; controla concurrencia y evita reintentar con frecuencia menor a una hora.
- Staff puede sincronizar manualmente, consultar el conjunto y modificar destacado/activo. Credenciales y Place ID son configuración externa.

## 10. Banners y contenido

- Placements: `HOME_HERO`, `HOME_RECOMMENDATION`, `CATALOG_STRIP`, `ANNOUNCEMENT_BAR`; tamaños `SQUARE` y `WIDE` (tamaño aplica a recomendaciones).
- El servicio valida requisitos por placement: recomendación requiere tamaño e imagen desktop; franja de catálogo requiere imagen; barra de anuncio requiere texto. Inicio/fin determinan vigencia; posición ordena dentro de un placement.
- Staff crea/edita contenido, imágenes, CTA/enlace y colores, elimina, activa/desactiva y reordena. El reordenamiento requiere IDs únicos del mismo placement.
- Multiparte usa campos `desktopImage` y `mobileImage`, hasta 5 MB por archivo y tipos JPG/PNG/WEBP/GIF/AVIF. Cloudinary almacena recursos.
- La documentación DTO indica límite de un banner activo vigente en `ANNOUNCEMENT_BAR`; verificar enforcement en servicio antes de tratarlo como restricción garantizada de API.

## 11. Contrato de endpoints

Prefijo común `/api`. Los métodos múltiples separados por coma comparten path. Consultar DTO/ruta por recurso para parámetros, campos y límites concretos. `:id`, `:code`, `:orderId`, `:supertokensId` son segmentos dinámicos.

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| `GET` | `/health` | Pública | Estado de salud. |
| `GET` | `/product`, `/product/:id` | Sesión opcional | Consultar catálogo/producto; ocultamiento de campos privados para no staff. |
| `POST` | `/product` | Staff | Crear producto y cargar imágenes. |
| `PUT` | `/product/:id` | Staff | Actualizar producto. |
| `PUT`, `DELETE` | `/product/:id/tags` | Staff | Reemplazar/asociar o retirar etiquetas. |
| `PUT`, `DELETE` | `/product/:id/active/` | Admin | Activar/desactivar producto. |
| `GET` | `/product/variant`, `/product/variant/:id` | Sesión opcional | Consultar variantes con vista pública protegida. |
| `POST` | `/product/variant` | Staff | Crear variante e imágenes. |
| `PUT` | `/product/variant/:id` | Staff | Actualizar variante e imágenes. |
| `PUT`, `DELETE` | `/product/variant/:id/active/` | Staff | Activar/desactivar variante. |
| `GET` | `/category`, `/category/:id` | Pública | Consultar categorías. |
| `POST` | `/category` | Staff | Crear categoría. |
| `PUT` | `/category/:id` | Staff | Actualizar categoría. |
| `PUT`, `DELETE` | `/category/:id/active/` | Staff | Activar/desactivar categoría. |
| `GET` | `/tag`, `/tag/:id` | Pública | Consultar etiquetas. |
| `POST` | `/tag` | Staff | Crear etiqueta. |
| `PUT` | `/tag/:id` | Staff | Actualizar etiqueta. |
| `PUT`, `DELETE` | `/tag/:id/active/` | Staff | Activar/desactivar etiqueta. |
| `GET` | `/brand`, `/brand/:id` | Pública | Consultar marcas. |
| `POST` | `/brand` | Staff | Crear marca. |
| `PUT` | `/brand/:id` | Staff | Actualizar marca. |
| `PUT`, `DELETE` | `/brand/:id/products` | Admin | Asociar/retirar productos de marca. |
| `PUT`, `DELETE` | `/brand/:id/active/` | Staff | Activar/desactivar marca. |
| `GET`, `POST` | `/supplier` | Staff | Listar y crear proveedores. |
| `GET`, `PUT` | `/supplier/:id` | Staff | Consultar/actualizar proveedor. |
| `PUT`, `DELETE` | `/supplier/:id/brands` | Staff | Asociar/retirar marcas. |
| `PUT`, `DELETE` | `/supplier/:id/active/` | Staff | Activar/desactivar proveedor. |
| `GET`, `POST` | `/movement` | Staff | Consultar y registrar movimientos manuales de stock. |
| `GET` | `/movement/:id` | Staff | Consultar movimiento. |
| `GET`, `POST` | `/offer` | Staff | Listar/crear ofertas. |
| `GET`, `PUT` | `/offer/:id` | Staff | Consultar/actualizar oferta. |
| `PUT`, `DELETE` | `/offer/:id/active/` | Staff | Activar/desactivar oferta. |
| `GET` | `/cart` | Staff | Listar carritos. |
| `POST` | `/cart` | Sesión opcional | Crear carrito guest/usuario. |
| `GET` | `/cart/me` | Sesión opcional | Obtener carrito correspondiente a la sesión/cookie. |
| `GET`, `PUT` | `/cart/:id` | Sesión opcional | Consultar/actualizar carrito con verificación de propiedad. |
| `GET` | `/cart/item` | Staff | Lectura interna de ítems de carrito. |
| `GET` | `/order` | Staff | Listar órdenes. |
| `POST` | `/order` | Autenticada | Crear orden desde ítems o carrito. |
| `GET` | `/order/mine` | Autenticada | Listar órdenes propias. |
| `GET`, `PUT` | `/order/:id` | Autenticada | Consultar/actualizar orden con control de propiedad/rol. |
| `GET` | `/order/item`, `/order/item/:id` | Staff | Consultar ítems de órdenes. |
| `GET` | `/user/me` | Autenticada | Consultar usuario de sesión. |
| `GET` | `/user/:supertokensId` | Autenticada | Consultar usuario por ID SuperTokens (no exige staff en middleware). |
| `GET` | `/user` | Staff | Listar usuarios paginados con roles SuperTokens. |
| `GET` | `/roles` | Staff | Listar roles disponibles en SuperTokens. |
| `GET` | `/shipment/meta` | Pública | Metadatos de métodos, estados/transiciones. |
| `GET` | `/shipment/track/:code` | Pública | Tracking reducido sin datos personales. |
| `GET` | `/shipment/order/:orderId` | Autenticada | Consultar envío de orden propia o staff. |
| `GET`, `POST` | `/shipment` | Staff | Listar/crear envíos. |
| `GET`, `PUT` | `/shipment/:id` | Staff | Consultar/editar datos del envío. |
| `POST` | `/shipment/:id/events` | Staff | Agregar evento y avanzar estado. |
| `GET` | `/review/summary` | Pública | Resumen agregado por producto. |
| `GET` | `/review` | Sesión opcional | Listado público aprobado; staff puede ver otros estados. |
| `GET` | `/review/stats` | Staff | Estadísticas de reseñas. |
| `GET` | `/review/mine` | Autenticada | Reseñas propias. |
| `GET` | `/review/eligible` | Autenticada | Elegibilidad para reseñar producto comprado. |
| `POST` | `/review` | Autenticada | Crear reseña de compra entregada. |
| `PUT`, `DELETE` | `/review/:id` | Autenticada | Editar/eliminar como autor o staff. |
| `PUT` | `/review/:id/moderate` | Staff | Aprobar/rechazar y responder. |
| `GET` | `/google-review` | Pública | Consultar reseñas destacadas; posible sync asíncrono. |
| `GET` | `/google-review/all` | Staff | Consultar todas las reseñas sincronizadas. |
| `POST` | `/google-review/sync` | Staff | Sincronizar desde Places API. |
| `PUT` | `/google-review/:id` | Staff | Actualizar destacado/activo. |
| `GET` | `/banner/placements`, `/banner/public` | Pública | Consultar placements/contenido visible. |
| `GET` | `/banner` | Staff | Listar banners. |
| `POST` | `/banner` | Staff | Crear banner y medios. |
| `GET`, `PUT` | `/banner/:id` | Staff | Consultar/editar banner. |
| `DELETE` | `/banner/:id` | Staff | Eliminar banner. |
| `PUT`, `DELETE` | `/banner/:id/active` | Staff | Activar/desactivar banner. |
| `PUT` | `/banner/reorder` | Staff | Reordenar banners del mismo placement. |
| `GET` | `/payment/config` | Pública | Informar disponibilidad de Mercado Pago. |
| `POST` | `/payment/webhook` | Pública | Recibir notificación y verificar el pago con proveedor. |
| `POST` | `/payment/order/:id/preference` | Autenticada | Crear preferencia de pago para orden propia compatible. |
| `POST` | `/payment/order/:id/sync` | Autenticada | Sincronizar estado de pago de orden propia. |

SuperTokens publica su propio flujo de autenticación bajo `/api/auth`; no se enumera como rutas del router de negocio.

## 12. Respuesta, consultas y errores

- Respuesta común: `{ statusCode, message, response }`; listados paginados incluyen `response.content` y `response.pagination`.
- CRUD genérico acepta filtros declarados por mapping; parámetros no mapeados pueden ignorarse. La paginación expone `paginate`, `currentPage`, `amountPerPage` en controladores aplicables; el tamaño tiene límite en repositorio.
- Errores esperados se traducen a HTTP: validación/solicitud 400; autenticación 401; autorización 403; ausente 404; conflicto/regla SQL 409; integración externa 502. Errores internos se ocultan parcialmente en producción.
- El orden de registro monta rutas específicas antes de rutas con `:id` para evitar que `item` se interprete como identificador.

## 13. Funciones de ejecución y soporte

- `GET /api/health` es health check para despliegue.
- Servidor intenta expirar pedidos impagos al iniciar y luego cada 30 minutos.
- `npm run seed:images` sirve como utilidad separada para buscar/subir imágenes de productos y banners; incluye dry-run, límites, selección por IDs/tipos y undo basado en JSONL.
- Docker/Render compilan TypeScript, generan Prisma y aplican migraciones en predeploy. Las pruebas backend corren con `npm test` usando el test runner nativo de Node.

## 14. Límites y asuntos a confirmar

- No se identificó asignación de roles de staff en la API; confirmar mecanismo SuperTokens externo antes de implementar administración de usuarios/roles.
- No se identificó integración automática con transportistas. El flujo de reintegro total de órdenes pagadas por Mercado Pago usa Resend para notificar al cliente.
- El límite de un banner activo para `ANNOUNCEMENT_BAR` aparece en DTO/especificación, pero no se verificó enforcement del servicio.
- La firma del webhook Mercado Pago se comprueba solo si existe secreto configurado. No tratarlo como autenticación de origen obligatoria cuando falta esa configuración.
- Validar estado real de migraciones y base antes de ejecutar cambios o hacer afirmaciones de producción.
