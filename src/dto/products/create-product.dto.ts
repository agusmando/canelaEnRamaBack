import { CreateInventoryDto } from "../inventory/create-inventory.dto.ts";

export class CreateProductDto {
    name: string;
    description?: string;
    // active?: boolean;
    price: number;
    supplierId: number;
    categoryId: number;
    Tags?: {id: number}[];
    currentStock: number; 
    movements: CreateInventoryDto[];

    constructor(name: string, description: string, price: number, categoryId: number, supplierId: number, currentStock: number, Tags?: {id: number}[], movements: CreateInventoryDto[] = []) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.categoryId = categoryId;
        this.supplierId = supplierId;
        this.Tags = Tags;
        this.currentStock = currentStock;
        this.movements = movements;
    }
}