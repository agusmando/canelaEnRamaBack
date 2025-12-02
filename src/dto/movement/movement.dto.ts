export class MovementDto {
  id: number;
  productId: number;
  quantity: number;
  type: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: number,
    productId: number,
    quantity: number,
    type: string,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.productId = productId;
    this.quantity = quantity;
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
