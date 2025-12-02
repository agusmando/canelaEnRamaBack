import { MovementDto } from "../movement/movement.dto.ts";

export class GetProductsDto {
    name: string;
    description: string;
    active: boolean;
    category: string;
    tags: string[];
    inventory: MovementDto[];
    currentStock: number;

    constructor(name: string, description: string, active: boolean, category: string, tags: string[], inventory: MovementDto[], currentStock: number) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.category = category;
        this.tags = tags;   
        this.inventory = inventory;
        this.currentStock = currentStock;
    }
}