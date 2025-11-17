export class GetProductsDto {
    name: string;
    description: string;
    active: boolean;
    category: string;
    tags: string[];

    constructor(name: string, description: string, active: boolean, category: string, tags: string[]) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.category = category;
        this.tags = tags;
    }
}