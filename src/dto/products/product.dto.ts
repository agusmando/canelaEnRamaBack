import { CategoryDto } from "../category/category.dto.ts";
import { DependencyDto } from "../dependency/dependency.dto.ts";
import { SupplierDto } from "../supplier/supplier.dto.ts";
import { TagDto } from "../tags/tag.dto.ts";
import { MovementDto } from "../movement/movement.dto.ts";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";

export class ProductDto {
  name: string;
  description: string;
  active: boolean;
  finalPrice: number;
  brandId: number;
  category?: CategoryDto;
  categoryId: number;
  measure?: { id: number; name: string };
  tags?: (TagDto | { id: number })[];
  variants: ProductVariantDto[] = [];

  constructor(
    name: string,
    description: string,
    active: boolean,
    brandId: number,
    categoryId: number,
    finalPrice: number,
    variants: ProductVariantDto[],
    measure?: { id: number; name: string },
    category?: CategoryDto,
    tags?: (TagDto | { id: number })[]
  ) {
    this.name = name;
    this.description = description;
    this.active = active;
    this.brandId = brandId;
    this.category = category;
    this.categoryId = categoryId;
    this.variants = variants;
    this.tags = tags;
    this.finalPrice = finalPrice;
    this.measure = measure;
  }
}
