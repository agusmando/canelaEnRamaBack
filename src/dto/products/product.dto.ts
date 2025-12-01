import { CategoryDto } from "../category/category.dto.ts";
import { InventoryDto } from "../inventory/inventory.dto.ts";
import { SupplierDto } from "../supplier/supplier.dto.ts";
import { TagDto } from "../tags/tag.dto.ts";

export class ProductDto {
    name: string;
    description: string;
    active: boolean;
    price: number;
    supplier?: SupplierDto;
    supplierId?: number;
    category?: CategoryDto;
    categoryId?: number;
    tags?: (TagDto | {  id: number })[];
    currentStock: string;

    constructor(
        name: string, 
        description: string, 
        active: boolean,
        price: number, 
        supplier: SupplierDto, 
        supplierId: number, 
        category: CategoryDto, 
        categoryId: number, 
        currentStock: string,
        tags?: (TagDto | {id: number})[],
    ) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.price = price;
        this.supplier = supplier;
        this.supplierId = supplierId;
        this.category = category;
        this.categoryId = categoryId;
        this.tags = tags;
        this.currentStock = currentStock;
    }
}