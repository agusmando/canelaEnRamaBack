import { CreateProductVariantDto } from "../product-variant/create-product-variant.dto.ts";
import { TagDto } from "../tags/tag.dto.ts";

export class UpdateProductDto {
  name: string;
  description: string;
  active: boolean;
  category: string;
  tags: TagDto[];
  brand?: string;
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
    brand?: string,
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
    this.brand = brand;
    this.measure = measure;
    this.addVariants = addVariants;
    this.removeVariants = removeVariants;
    this.activateVariants = activateVariants;
    this.deactivateVariants = deactivateVariants;
    this.price = price;
    this.profitMargin = profitMargin;
  }
}
