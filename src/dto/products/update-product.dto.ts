import { TagDto } from "../tags/tag.dto.ts";

export class UpdateProductDto {
  name: string;
  description: string;
  active: boolean;
  category: string;
  tags: TagDto[];
  brand?: string;
  addVariants?: string[];
  removeVariants?: string[];

  constructor(
    name: string,
    description: string,
    active: boolean,
    category: string,
    tags: TagDto[],
    brand?: string,
    addVariants?: string[],
    removeVariants?: string[]
  ) {
    this.name = name;
    this.description = description;
    this.active = active;
    this.category = category;
    this.tags = tags;
    this.brand = brand;
    this.addVariants = addVariants;
    this.removeVariants = removeVariants;
  }
}
