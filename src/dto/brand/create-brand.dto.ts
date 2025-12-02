export class CreateBrandDto {
  name: string;
  products: { id: number }[];
  description?: string;
  constructor(name: string, products: { id: number }[], description?: string) {
    this.name = name;
    this.description = description;
    this.products = products;
  }
}
