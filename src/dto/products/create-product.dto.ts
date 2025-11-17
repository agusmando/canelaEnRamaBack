export class CreateProductDto {
    name: string;
    description?: string;
    // active?: boolean;
    price: number;
    supplierId: number;
    categoryId: number;
    Tags?: {id: number}[];

    constructor(name: string, description: string, price: number, categoryId: number, supplierId: number, Tags?: {id: number}[]) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.categoryId = categoryId;
        this.supplierId = supplierId;
        this.Tags = Tags;
    }
}