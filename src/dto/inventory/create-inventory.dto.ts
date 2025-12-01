export class CreateInventoryDto {
    // productId: number;
    quantity: number;
    type: string;

    constructor(
        quantity: number,
        type: string
    ) {
        this.quantity = quantity;
        this.type = type;
    }
}