import { ProductDto } from "../products/product.dto.js";

export class UpdateBrandDto {
  name: string;
  description: string;
  products: ProductDto[];
  constructor(name: string, description: string, products: ProductDto[]) {
    this.name = name;
    this.description = description;
    this.products = products;
  }
}
