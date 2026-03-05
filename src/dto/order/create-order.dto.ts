import { CreateOrderItemDto } from "../order-item/create-order-item.dto.js";

export class CreateOrderDto {
  userSuperTokensId: string;
  totalPrice: number;
  totalItems: number;
  paymentType: string;
  status: string;
  orderItems: CreateOrderItemDto[] = [];
  estimatedReadyAt?: Date;

  constructor(
    userSuperTokensId: string,
    totalPrice: number,
    totalItems: number,
    paymentType: string,
    status: string,
    orderItems: CreateOrderItemDto[],
    estimatedReadyAt?: Date
  ) {
    this.userSuperTokensId = userSuperTokensId;
    this.totalPrice = totalPrice;
    this.totalItems = totalItems;
    this.paymentType = paymentType;
    this.status = status;
    this.orderItems = orderItems;
    this.estimatedReadyAt = estimatedReadyAt;
  }
}
