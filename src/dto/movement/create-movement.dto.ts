export class CreateMovementDto {
  productVariantId: number;
  /** Delta de stock: positivo entra, negativo sale (gramos si es KG). */
  quantity: number;
  /** IN | OUT | ADJUSTMENT | RETURN. PRODUCTION se genera solo al producir mixes. */
  type: string;
  /** Fecha del movimiento (ISO), por defecto ahora; no puede ser futura ni tener más de un año. */
  createdAt?: string;
  constructor(productVariantId: number, quantity: number, type: string, createdAt?: string) {
    this.productVariantId = productVariantId;
    this.quantity = quantity;
    this.type = type;
    this.createdAt = createdAt;
  }
}
