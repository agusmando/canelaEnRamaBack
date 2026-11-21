import { CreateProductVariantDto } from "../product-variant/create-product-variant.dto.js";
import { TagDto } from "../tags/tag.dto.js";

export class UpdateProductDto {
  name: string;
  description: string;
  active: boolean;
  category: string;
  categoryId?: number;
  tags: TagDto[];
  brand?: string;
  brandId?: number;
  measure?: string
  addVariants?: CreateProductVariantDto[];
  removeVariants?: number[];
  activateVariants?: number[];
  deactivateVariants?: number[];
  price?: number;
  profitMargin?: number;

  constructor(
    name: string,
    description: string,
    active: boolean,
    category: string,
    tags: TagDto[],
    categoryId?: number,
    brand?: string,
    brandId?: number,
    measure?: string,
    addVariants?: CreateProductVariantDto[],
    removeVariants?: number[],
    activateVariants?: number[],
    deactivateVariants?: number[],
    price?: number,
    profitMargin?: number
  ) {
    this.name = name;
    this.description = description;
    this.active = active;
    this.category = category;
    this.tags = tags;
    this.categoryId = categoryId;
    this.brand = brand;
    this.brandId = brandId;
    this.measure = measure;
    this.addVariants = addVariants;
    this.removeVariants = removeVariants;
    this.activateVariants = activateVariants;
    this.deactivateVariants = deactivateVariants;
    this.price = price;
    this.profitMargin = profitMargin;
  }
}
