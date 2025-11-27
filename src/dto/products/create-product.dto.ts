import { CreateInventoryDto } from "../inventory/create-inventory.dto.ts";

export class CreateProductDto {
    name: string;
    description?: string;
    // active?: boolean;
    price: number;
    supplierId: number;
    categoryId: number;
    Tags?: {id: number}[];
    Inventory: CreateInventoryDto[];

    constructor(name: string, description: string, price: number, categoryId: number, supplierId: number, Tags?: {id: number}[], Inventory: CreateInventoryDto[] = []) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.categoryId = categoryId;
        this.supplierId = supplierId;
        this.Tags = Tags;
        this.Inventory = Inventory;
    }
}