export class UpdateSupplierBrandDto {
  brandsId: { id: number }[];

  constructor(brandsId: { id: number }[]) {
    this.brandsId = brandsId;
  }
}
