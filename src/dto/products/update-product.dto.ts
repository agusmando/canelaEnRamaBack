import { TagDto } from "../tags/tag.dto.ts";

export class UpdateProductDto {
    name: string;
    description: string;
    active: boolean;
    category: string;
    tags: TagDto[];
    quantity: number;

    constructor(name: string, description: string, active: boolean, category: string, tags: TagDto[], quantity: number) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.category = category;
        this.tags = tags;
        this.quantity = quantity;
    }
}