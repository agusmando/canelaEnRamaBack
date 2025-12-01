import { TagDto } from "../tags/tag.dto.ts";

export class UpdateProductDto {
    name: string;
    description: string;
    active: boolean;
    category: string;
    tags: TagDto[];
    movementType: string;
    currentStock?: number;
    stockIncrement?: number;

    constructor(name: string, description: string, active: boolean, category: string, tags: TagDto[], movementType: string,currentStock?: number,  stockIncrement?: number) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.category = category;
        this.tags = tags;
        this.currentStock = currentStock;
        this.movementType = movementType;
        this.stockIncrement = stockIncrement
    }
}