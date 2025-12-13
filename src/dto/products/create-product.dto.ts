import { MeasureType } from "@prisma/client";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";
export class CreateProductDto {
  name: string;
  description?: string;
  brandId: number;
  categoryId: number;
  Tags?: { id: number }[];
  measure: MeasureType;
  variants: ProductVariantDto[] = [];

  constructor(
    name: string,
    description: string,
    categoryId: number,
    brandId: number,
    measure: MeasureType,
    variants: ProductVariantDto[],
    Tags?: { id: number }[]
  ) {
    this.name = name;
    this.description = description;
    this.categoryId = categoryId;
    this.brandId = brandId;
    this.Tags = Tags;
    this.measure = measure;
    this.variants = variants;
  }
}
