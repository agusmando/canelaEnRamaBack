import { MeasureType } from "@prisma/client";
import { DependencyDto } from "../dependency/dependency.dto.ts";
import { ProductDto } from "../products/product.dto.ts";
import { MovementDto } from "../movement/movement.dto.ts";

export class ProductVariantDto {
  productId: number;
  name: string;
  price: number;
  profitMargin: number;
  currentStock: number;
  active: boolean;
  contentMeasure?: MeasureType;
  contentAmount: number;
  requestTime: string;
  product?: ProductDto;
  measureTypeId: number;
  isComponentOf?: DependencyDto[];
  hasComponents?: DependencyDto[];
  movements?: MovementDto[] = [];

  constructor(
    name: string,
    active: boolean,
    price: number,
    productId: number,
    profitMargin: number,
    currentStock: number,
    contentAmount: number,
    requestTime: string,
    measureTypeId: number,
    contentMeasure?: MeasureType,
    product?: ProductDto,
    isComponentOf?: DependencyDto[],
    hasComponents?: DependencyDto[],
    movements?: MovementDto[]
  ) {
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
  }
}
