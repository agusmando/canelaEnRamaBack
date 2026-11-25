export class MovementDto {
  id: number;
  productVariantId: number;
  quantity: number;
  priceAtTime: number;
  type: string;
  note?: string | null;
  createdAt: Date;
  constructor(
    id: number,
    productVariantId: number,
    quantity: number,
    priceAtTime: number,
    type: string,
    createdAt: Date,
    note?: string | null,
  ) {
    this.id = id;
    this.productVariantId = productVariantId;
    this.quantity = quantity;
    this.priceAtTime = priceAtTime;
    this.type = type;
    this.note = note;
    this.createdAt = createdAt;
  }
}
