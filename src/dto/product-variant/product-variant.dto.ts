import { DependencyDto } from "../dependency/dependency.dto.ts";
import { ProductDto } from "../products/product.dto.ts";
import { MovementDto } from "../movement/movement.dto.ts";

export class ProductVariantDto {
  id: number;
  productId: number;
  name: string;
  price?: number;
  profitMargin?: number;
  currentStock: number;
  active: boolean;
  availableWeb: boolean;
  availablePedidosYa: boolean;
  contentMeasure?: { id: number; name: string };
  contentAmount: number;
  requestTime: string;
  product?: ProductDto;
  measureTypeId: number;
  isComponentOf?: DependencyDto[];
  hasComponents?: DependencyDto[];
  movements?: MovementDto[] = [];
  finalPrice?: number;
  constructor(
    id: number,
    name: string,
    active: boolean,
    productId: number,
    currentStock: number,
    contentAmount: number,
    requestTime: string,
    measureTypeId: number,
    availableWeb: boolean,
    availablePedidosYa: boolean,
    contentMeasure?: { id: number; name: string },
    profitMargin?: number,
    price?: number,
    product?: ProductDto,
    isComponentOf?: DependencyDto[],
    hasComponents?: DependencyDto[],
    movements?: MovementDto[],
    finalPrice?: number,
  ) {
    this.id = id;
    this.productId = productId;
    this.name = name;
    this.active = active;
    this.price = price;
    this.profitMargin = profitMargin;
    this.currentStock = currentStock;
    this.contentMeasure = contentMeasure;
    this.contentAmount = contentAmount;
    this.requestTime = requestTime;
    this.product = product;
    this.measureTypeId = measureTypeId;
    this.isComponentOf = isComponentOf;
    this.hasComponents = hasComponents;
    this.movements = movements;
    this.finalPrice = finalPrice;
    this.availableWeb = availableWeb;
    this.availablePedidosYa = availablePedidosYa;
  }
}
