import { ProductDto } from "../products/product.dto.ts";

export class BrandDto {
  id: number;
  name: string;
  description: string;
  products?: (ProductDto | { id: number })[];
  constructor(
    id: number,
    name: string,
    description: string,
    products: (ProductDto | { id: number })[] = []
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.products = products;
  }
}
