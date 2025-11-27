import { InventoryDto } from "../inventory/inventory.dto.ts";

export class GetProductsDto {
    name: string;
    description: string;
    active: boolean;
    category: string;
    tags: string[];
    inventory: InventoryDto[];

    constructor(name: string, description: string, active: boolean, category: string, tags: string[], inventory: InventoryDto[]) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.category = category;
        this.tags = tags;
        this.inventory = inventory;
    }
}