import { CategoryDto } from "../category/category.dto.js";
import { TagDto } from "../tags/tag.dto.js";
import { ProductVariantDto } from "../product-variant/product-variant.dto.js";

export class ProductDto {
  name: string;
  description: string;
  active: boolean;
  brandId: number;
  finalPrice?: number;
  category?: CategoryDto;
  categoryId: number;
  measure?: string;
  tags?: (TagDto | { id: number })[];
  variants: ProductVariantDto[] = [];

  constructor(
    name: string,
    description: string,
    active: boolean,
    brandId: number,
    categoryId: number,
    variants: ProductVariantDto[],
    finalPrice?: number,
    measure?: string,
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
