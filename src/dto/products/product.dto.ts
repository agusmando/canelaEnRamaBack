import { MeasureType } from "@prisma/client";
import { CategoryDto } from "../category/category.dto.ts";
import { DependencyDto } from "../dependency/dependency.dto.ts";
import { SupplierDto } from "../supplier/supplier.dto.ts";
import { TagDto } from "../tags/tag.dto.ts";
import { MovementDto } from "../movement/movement.dto.ts";

export class ProductDto {
  name: string;
  description: string;
  active: boolean;
  price: number;
  profitMargin: number;
  brandId?: number;
  category?: CategoryDto;
  categoryId?: number;
  measure: MeasureType;
  contentAmount?: number;
  onRequest?: boolean;
  requestTime?: string;
  tags?: (TagDto | { id: number })[];
  currentStock: string;
  finalPrice: number;
  isComponentOf?: DependencyDto[];
  // hasComponents?: DependencyDto[];
  movements: MovementDto[] = [];

  constructor(
    name: string,
    description: string,
    active: boolean,
    price: number,
    profitMargin: number,
    brandId: number,
    categoryId: number,
    currentStock: string,
    finalPrice: number,
    measure: MeasureType,
    contentAmount?: number,
    onRequest?: boolean,
    requestTime?: string,
    category?: CategoryDto,
    tags?: (TagDto | { id: number })[],
    isComponentOf?: DependencyDto[],
    // hasComponents?: DependencyDto[],
    movements: MovementDto[] = []
  ) {
    this.name = name;
    this.description = description;
    this.active = active;
    this.price = price;
    this.profitMargin = profitMargin;
    this.brandId = brandId;
    this.category = category;
    this.categoryId = categoryId;
    this.tags = tags;
    this.currentStock = currentStock;
    this.finalPrice = finalPrice;
    this.measure = measure;
    this.contentAmount = contentAmount;
    this.onRequest = onRequest;
    this.requestTime = requestTime;
    this.isComponentOf = isComponentOf;
    // this.hasComponents = hasComponents;
    this.movements = movements;
  }
}
