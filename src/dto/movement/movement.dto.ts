export class MovementDto {
  id: number;
  productVariantId: number;
  quantity: number;
  priceAtTime: number;
  type: string;
  createdAt: Date;
  constructor(
    id: number,
    productVariantId: number,
    quantity: number,
    priceAtTime: number,
    type: string,
    createdAt: Date,
  ) {
    this.id = id;
    this.productVariantId = productVariantId;
    this.quantity = quantity;
    this.priceAtTime = priceAtTime;
    this.type = type;
    this.createdAt = createdAt;
  }
}
