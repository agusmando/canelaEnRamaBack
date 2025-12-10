import { TagDto } from "../tags/tag.dto.ts";

export class UpdateProductDto {
  name: string;
  description: string;
  active: boolean;
  category: string;
  tags: TagDto[];
  movementType: string;
  currentStock?: number;
  price?: number;
  stockIncrement?: number;
  profitMargin?: number;
  addComponents?: { productId: number; quantity: number }[];
  removeComponents?: { productId: number }[];
  editComponents?: { productId: number; quantity: number }[];

  constructor(
    name: string,
    description: string,
    active: boolean,
    category: string,
    tags: TagDto[],
    movementType: string,
    currentStock?: number,
    price?: number,
    profitMargin?: number,
    stockIncrement?: number,
    addComponents?: { productId: number; quantity: number }[],
    removeComponents?: { productId: number }[],
    editComponents?: { productId: number; quantity: number }[]
  ) {
    this.name = name;
    this.description = description;
    this.active = active;
    this.category = category;
    this.tags = tags;
    this.currentStock = currentStock;
    this.movementType = movementType;
    this.profitMargin = profitMargin;
    this.price = price;
    this.stockIncrement = stockIncrement;
    this.addComponents = addComponents;
    this.removeComponents = removeComponents;
    this.editComponents = editComponents;
  }
}
