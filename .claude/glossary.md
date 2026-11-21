# Glosario y vocabulario contractual

Este glosario recoge conceptos del negocio, entidades, campos y literales del backend. Los valores en mayúsculas deben tratarse como valores exactos de API/base de datos; cambiar su nombre o semántica puede romper clientes, datos persistidos, SQL o integraciones.

## Conceptos de negocio

| Término | Significado en este proyecto |
|---|---|
| Producto (`Product`) | Entrada del catálogo con nombre, descripción, categoría, marca, medida y una o más variantes. Tiene activación propia. |
| Variante (`ProductVariant`) | Presentación vendible de un producto; contiene costo (`price`), margen, stock, medida/contenido, opciones de paquete, imágenes y disponibilidad. |
| Mix / combo | Variante compuesta por otras variantes. Su receta se representa con `Dependency`; producirla consume stock de componentes. |
| Componente / dependencia | Variante y cantidad requerida para fabricar una unidad de un mix. `mixVariantId` es el mix; `productVariantId` identifica el componente. |
| Medida (`Measure`) | Unidad física de contenido/venta. Para `KG`, el inventario suelto se expresa en gramos y el precio calculado se refiere al kilo. |
| Presentación / bulk option | Tamaño de paquete incluido en `packagingOptions`. `selectedBulkOption = 0` representa venta suelta; un valor positivo representa el tamaño de paquete seleccionado. |
| Stock actual | Inventario disponible en `ProductVariant.currentStock`. Los cambios deben registrar movimientos por las operaciones de stock, no escribir el valor directamente. |
| Umbral de stock | Cantidad mínima usada por ciertas reglas de disponibilidad/oferta (`stockThreshold`). No confundir los umbrales de variante y oferta. |
| Movimiento de stock | Registro auditable de una entrada, salida, ajuste, devolución o producción, con cantidad y precio al momento. |
| Costo / `price` | Campo base de costo de la variante, no necesariamente el precio público de venta. No exponerlo a usuarios no staff. |
| Margen / `profitMargin` | Margen usado para derivar precio final. El precio de venta se calcula como costo × (1 + margen) y se redondea según `roundingOption`. |
| Precio final | Precio comercial derivado; puede incorporar oferta vigente. No reemplaza los snapshots guardados en órdenes. |
| Oferta | Regla de descuento temporal aplicada a un producto o variante, condicionada por vigencia, activación y, opcionalmente, stock/cantidad. |
| Carrito de invitado | Carrito asociado a `sessionId` y a la cookie `guest_cart_id`; al autenticarse puede fusionarse con el carrito de usuario. |
| Línea de carrito | Cantidad de una variante y presentación. La clave lógica es carrito + variante + `selectedBulkOption`. |
| Pedido / orden (`Order`) | Compra del usuario. Su estado operativo y su estado de pago son independientes. |
| Snapshot | Copia histórica de nombre, variante, precio, descuento y oferta usada en el pedido; preserva lo cobrado aunque cambie el catálogo. |
| Devolución | Retorno total/parcial de una línea, con actualización de estados y reposición de stock cuando corresponde. |
| Envío / retiro (`Shipment`) | Registro único por orden que soporta entrega o retiro y mantiene un historial de eventos. Los datos del transportista se cargan manualmente. |
| Tracking | Seguimiento público por `trackingCode`; la respuesta no debe exponer datos personales de destinatario. |
| Reseña de producto (`Review`) | Opinión de un comprador verificado sobre una variante; requiere pedido entregado y moderación antes de publicarse. |
| Reseña de Google (`GoogleReview`) | Reseña externa sincronizada desde Google Places y persistida en caché; el staff administra su visibilidad/destacado. |
| Banner / placement | Contenido administrable que ocupa un espacio web indicado por `BannerPlacement`; `position` determina orden dentro del placement. |
| Staff | Usuario cuyo rol SuperTokens es `ADMIN` o `EMPLOYEE`. No asumir que `User.role` de Prisma es la fuente usada por el middleware. |
| Reposición | Entrada de inventario o producción de un mix. `PRODUCTION` se reserva a la lógica de fabricación de mixes. |

## Enums de Prisma — literales exactos

Fuente de verdad: `src/config/prisma/schema.prisma`.

- `Measure`: `KG`, `U`, `L`, `ML`, `G`.
- `MovementType`: `IN`, `OUT`, `ADJUSTMENT`, `RETURN`, `PRODUCTION`.
- `DiscountType`: `PERCENTAGE`, `FIXED`, `BUY_ONE_GET_MORE`, `BUY_MORE_GET_MORE`, `BUY_MORE_GET_DISCOUNT`, `BUY_MORE_GET_FIXED_DISCOUNT`.
- `ReviewStatus`: `PENDING`, `APPROVED`, `REJECTED`.
- `BannerPlacement`: `HOME_HERO`, `HOME_RECOMMENDATION`, `CATALOG_STRIP`, `ANNOUNCEMENT_BAR`.
- `BannerSize`: `SQUARE`, `WIDE`.
- `UserRole`: `ADMIN`, `EMPLOYEE`, `CONSUMER`.
- `PaymentStatus`: `PENDING`, `IN_PROCESS`, `APPROVED`, `REJECTED`, `CANCELLED`, `REFUNDED`, `CHARGED_BACK`.
- `OrderStatus`: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`.
- `OrderItemStatus`: `FULFILLED`, `AWAITING_STOCK`, `PARTIALLY_RETURNED`, `CANCELLED`, `RETURNED`.
- `ShipmentMethod`: `DELIVERY`, `PICKUP`.
- `ShipmentStatus`: `PENDING`, `PREPARING`, `READY_FOR_PICKUP`, `SHIPPED`, `OUT_FOR_DELIVERY`, `FAILED_ATTEMPT`, `DELIVERED`, `RETURNED`, `CANCELLED`.

## Literales de aplicación e integración

No todos son enums Prisma: algunos son cadenas validadas por servicios o contratos de terceros.

- Tipos de pago (`PAYMENT_TYPES`): `CASH`, `TRANSFER`, `MERCADOPAGO`.
- Roles staff: `ADMIN`, `EMPLOYEE`. `CONSUMER` no es staff.
- Movimientos permitidos en el alta manual: `IN`, `OUT`, `ADJUSTMENT`, `RETURN`. `PRODUCTION` es interno a mixes.
- Estados externos de Mercado Pago: `pending`, `authorized`, `in_process`, `in_mediation`, `approved`, `rejected`, `cancelled`, `refunded`, `charged_back`. El mapeo externo a interno está en el servicio de pagos; `authorized` e `in_mediation` se consideran `IN_PROCESS`.
- Cookie de carrito invitado: `guest_cart_id`.
- Prefijo de código público de envío: `CER-`.
- Respuesta de salud: `status: "ok"`.
- Literales de placement/tamaño/reseña/envío se definen también en DTOs bajo `src/dto/banner`, `src/dto/review` y `src/dto/shipment`.

## Campos importantes

El inventario siguiente refleja nombres exactos de modelos/campos de `schema.prisma` (incluye nombres con mayúsculas que conviene preservar al seleccionar relaciones de Prisma). No implica que todos sean campos públicos ni aceptados por cada endpoint.

| Modelo | Campos/relaciones definidos |
|---|---|
| `Product` | `id`, `name`, `description`, `active`, `Category`, `categoryId`, `Brand`, `brandId`, `Tags`, `variants`, `measure`, `offers`, `reviews` |
| `ProductVariant` | `id`, `productId`, `name`, `price`, `profitMargin`, `currentStock`, `active`, `contentMeasure`, `contentAmount`, `packagingOptions`, `requestTime`, `stockThreshold`, `roundingOption`, `product`, `isComponentOf`, `hasComponents`, `movements`, `offers`, `images`, `CartItem`, `orderItems`, `reviews`, `availableWeb` |
| `Dependency` | `mixVariantId`, `productVariantId`, `quantity`, `active`, `mixVariant`, `componentProduct` |
| `Brand` | `id`, `name`, `description`, `suppliers`, `products`, `createdAt`, `updatedAt`, `active` |
| `Category` | `id`, `name`, `description`, `products`, `active` |
| `Tag` | `id`, `name`, `products`, `active` |
| `StockMovement` | `id`, `productVariantId`, `quantity`, `priceAtTime`, `type`, `createdAt`, `productVariant` |
| `Supplier` | `id`, `name`, `contact`, `description`, `createdAt`, `updatedAt`, `active`, `brands` |
| `Offer` | `id`, `productVariantId`, `ProductVariant`, `productId`, `Product`, `startTime`, `finishTime`, `discountValue`, `discountType`, `discountQuantity`, `quantityToGet`, `stockThreshold`, `active` |
| `Review` | `id`, `productId`, `productVariantId`, `userSuperTokensId`, `orderId`, `rating`, `title`, `comment`, `status`, `rejectionReason`, `reply`, `repliedAt`, `moderatedAt`, `createdAt`, `updatedAt`, `product`, `productVariant`, `user` |
| `GoogleReview` | `id`, `googleId`, `authorName`, `authorPhotoUrl`, `authorUrl`, `rating`, `text`, `language`, `relativeTime`, `publishedAt`, `featured`, `active`, `fetchedAt` |
| `GooglePlace` | `placeId`, `name`, `rating`, `userRatingCount`, `googleMapsUri`, `lastSyncAt`, `lastError` |
| `Banner` | `id`, `placement`, `name`, `eyebrow`, `headline`, `text`, `ctaLabel`, `linkUrl`, `size`, `desktopImageUrl`, `desktopImagePublicId`, `mobileImageUrl`, `mobileImagePublicId`, `backgroundColor`, `textColor`, `position`, `startsAt`, `endsAt`, `active`, `createdAt`, `updatedAt` |
| `Image` | `id`, `productVariantId`, `public_id`, `secure_url`, `ProductVariant` |
| `User` | `id`, `supertokensId`, `email`, `name`, `avatarUrl`, `role`, `createdAt`, `updatedAt`, `cart`, `orders`, `reviews` |
| `Cart` | `id`, `userSuperTokensId`, `createdAt`, `updatedAt`, `sessionId`, `user`, `items` |
| `CartItem` | `cartId`, `productVariantId`, `selectedBulkOption`, `quantity`, `createdAt`, `cart`, `productVariant` |
| `Order` | `id`, `userSuperTokensId`, `user`, `createdAt`, `updatedAt`, `totalPrice`, `totalItems`, `paymentType`, `estimatedReadyAt`, `status`, `orderItems`, `shipment`, `paymentStatus`, `paymentStatusDetail`, `paymentId`, `paymentPreferenceId`, `paidAt` |
| `OrderItem` | `id`, `orderId`, `productVariantId`, `productNameSnapshot`, `variantNameSnapshot`, `unitPriceSnapshot`, `discountAppliedSnapshot`, `offerTypeSnapshot`, `quantity`, `status`, `awaitingStockAt`, `selectedBulkOption`, `Order`, `productVariant` |
| `Shipment` | `id`, `orderId`, `trackingCode`, `method`, `status`, `carrier`, `carrierTrackingCode`, `carrierTrackingUrl`, `recipientName`, `phone`, `address`, `city`, `province`, `postalCode`, `notes`, `cost`, `estimatedDeliveryAt`, `shippedAt`, `deliveredAt`, `createdAt`, `updatedAt`, `order`, `events` |
| `ShipmentEvent` | `id`, `shipmentId`, `status`, `description`, `location`, `createdAt`, `shipment` |

`schema.prisma` también define nombres de índices/constraints compuestos mediante `@@id`, `@@unique` e `@@index`; revisar el schema antes de alterar claves o cardinalidad.

| Campo | Semántica contractual |
|---|---|
| `currentStock` | Stock de la variante; las mutaciones deben pasar por funciones/repositorio de movimientos. |
| `stockIncrement` | Delta de stock, distinto de establecer stock absoluto. |
| `packagingOptions` | Tamaños de paquete habilitados para la variante. |
| `selectedBulkOption` | Tamaño elegido en la línea; cero significa venta suelta. |
| `contentMeasure`, `contentAmount` | Medida y contenido neto/presentación de la variante. |
| `availableWeb` | Disponibilidad de la variante en el canal web propio. |
| `priceAtTime` | Precio asociado al movimiento de stock, no precio público actual. |
| `discountAppliedSnapshot`, `offerTypeSnapshot` | Valores históricos aplicados al momento de crear la orden. |
| `userSuperTokensId`, `supertokensId` | Identificadores que relacionan registros locales con SuperTokens. |
| `paymentStatus` | Estado del cobro; independiente de `Order.status`. |
| `trackingCode`, `carrierTrackingCode`, `carrierTrackingUrl` | Código de tracking público interno, código externo y URL externa respectivamente. |
| `featured`, `active` en `GoogleReview` | Selección y activación local de reseñas sincronizadas; no alteran la reseña original en Google. |
| `startsAt`, `endsAt` | Ventana temporal de visibilidad de banner. |

## Precauciones de vocabulario

1. No traducir ni renombrar literales persistidos o enviados por API sin migración y evaluación de compatibilidad.
2. No mezclar `OrderStatus` con `PaymentStatus` ni `ShipmentStatus`.
3. En documentación, usar «costo» para `price` cuando se explique la vista pública; reservar «precio final» para el valor derivado.
4. No afirmar que hay integración de canales externos no implementados.
