import { CreateMovementDto } from "../movement/create-movement.dto.ts";

export class CreateProductDto {
    name: string;
    description?: string;
    // active?: boolean;
    price: number;
    supplierId: number;
    categoryId: number;
    Tags?: {id: number}[];
    currentStock: number; 
    movements: CreateMovementDto[];

    constructor(name: string, description: string, price: number, categoryId: number, supplierId: number, currentStock: number, Tags?: {id: number}[], movements: CreateMovementDto[] = []) {
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