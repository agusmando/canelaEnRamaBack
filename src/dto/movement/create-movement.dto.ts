export class CreateMovementDto {
  productVariantId: number;
  /** Delta de stock: positivo entra, negativo sale (gramos si es KG). */
  quantity: number;
  /** IN | OUT | ADJUSTMENT | RETURN. PRODUCTION se genera solo al producir mixes. */
  type: string;
  constructor(productVariantId: number, quantity: number, type: string) {
    this.productVariantId = productVariantId;
    this.quantity = quantity;
    this.type = type;
  }
}
