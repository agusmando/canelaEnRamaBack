import { MeasureType } from "@prisma/client";
import { CreateMovementDto } from "../movement/create-movement.dto.ts";

export class CreateProductDto {
  name: string;
  description?: string;
  // active?: boolean;
  price?: number;
  brandId: number;
  categoryId: number;
  Tags?: { id: number }[];
  currentStock: number;
  measure: MeasureType;
  onRequest?: boolean;
  requestTime?: string;
  contentAmount?: number;
  hasComponents?: { productId: number; quantity: number }[];

  constructor(
    name: string,
    description: string,
    categoryId: number,
    brandId: number,
    currentStock: number,
    measure: MeasureType,
    price?: number,
    Tags?: { id: number }[],
    hasComponents?: { productId: number; quantity: number }[],
    contentAmount?: number,
    onRequest?: boolean,
    requestTime?: string
  ) {
    this.name = name;
    this.description = description;
    this.price = price;
    this.categoryId = categoryId;
    this.brandId = brandId;
    this.Tags = Tags;
    this.currentStock = currentStock;
    this.hasComponents = hasComponents;
    this.measure = measure;
    this.contentAmount = contentAmount;
    this.onRequest = onRequest;
    this.requestTime = requestTime;
  }
}
