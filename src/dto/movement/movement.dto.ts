export class MovementDto {
    id: number;
    productId: number;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;

    constructor(
        id: number,
        productId: number,
        quantity: number,
        createdAt: Date,
        updatedAt: Date
    ) {
        this.id = id;
        this.productId = productId;
        this.quantity = quantity;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}