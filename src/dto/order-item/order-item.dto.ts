
/**
 *  id               Int  @id @default(autoincrement())
  orderId          Int
  productVariantId Int? // Opcional por si el producto se borra del catálogo

  productNameSnapshot String // Ej: "Yogurt"
  variantNameSnapshot String // Ej: "Vainilla"
  unitPriceSnapshot   Float // El precio al que se vendió EXACTAMENTE ese día

  quantity Int

  Order          Order           @relation(fields: [orderId], references: [id])
  productVariant ProductVariant? @relation(fields: [productVariantId], references: [id])
 */

import { OrderDto } from "../order/order.dto.ts";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";

export class OrderItemDto {
  id: number;
  orderId: number;
  productVariantId: number;
  productVariant?: ProductVariantDto;
  order?: OrderDto;
  
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;

  constructor(
    id: number,
    orderId: number,
    productVariantId: number,
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
    productVariant?: ProductVariantDto,
    order?: OrderDto
  ) {
    this.id = id;
    this.orderId = orderId;
    this.productVariantId = productVariantId;
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
    this.productVariant = productVariant;
    this.order = order;
  } 
};