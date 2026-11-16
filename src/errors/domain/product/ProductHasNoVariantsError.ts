// errors/domain/product/ProductHasNoVariantsError.ts
export class ProductHasNoVariantsError extends Error {
  constructor() {
    super("Product must have at least one variant");
    this.name = "ProductHasNoVariantsError";
  }
}
