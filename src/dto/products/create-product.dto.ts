import { CreateProductVariantDto } from "../product-variant/create-product-variant.dto.ts";
export class CreateProductDto {
  name: string;
  description?: string;
  brandId: number;
  categoryId: number;
  Tags?: { id: number }[];
  measure: string;
  variants: CreateProductVariantDto[] = [];

  constructor(
    name: string,
    description: string,
    categoryId: number,
    brandId: number,
    measure: string,
    variants: CreateProductVariantDto[],
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
