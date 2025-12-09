import { ProductDto } from "../products/product.dto.ts";

export class DependencyDto {
  id: number;
  mixId: number;
  name: string;
  quantity: number;
  active: boolean;
  mixProduct: ProductDto;
  componentProduct: ProductDto | { id: number };
  constructor(
    id: number,
    mixId: number,
    name: string,
    quantity: number,
    active: boolean,
    mixProduct: ProductDto,
    componentProduct: ProductDto | { id: number }
  ) {
    this.id = id;
    this.mixId = mixId;
    this.name = name;
    this.quantity = quantity;
    this.active = active;
    this.mixProduct = mixProduct;
    this.componentProduct = componentProduct;
  }
}
