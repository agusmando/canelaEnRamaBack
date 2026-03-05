import { UpdateOrderItemDto } from "../order-item/update-order-item.dto.js";

export class UpdateOrderDto {
  totalPrice: number;
  totalItems: number;
  paymentType: string;
  status: string;
  estimatedReadyAt: Date;
  editItem: UpdateOrderItemDto[];
  constructor(
    totalPrice: number,
    totalItems: number,
    paymentType: string,
    status: string,
    estimatedReadyAt: Date,
    editItem: UpdateOrderItemDto[]
  ) {
    this.totalPrice = totalPrice;
    this.totalItems = totalItems;
    this.paymentType = paymentType;
    this.status = status;
    this.estimatedReadyAt = estimatedReadyAt;
    this.editItem = editItem;
  }
}
