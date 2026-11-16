// errors/domain/product/ProductHasNoVariantsError.ts
export class InvalidMeasureError extends Error {
  constructor() {
    super("Invalid measure");
    this.name = "InvalidMeasureError";
  }
}
