export class UpdateBrandProductDto {
  productsId: { id: number }[];

  constructor(productsId: { id: number }[]) {
    this.productsId = productsId;
  }
}
