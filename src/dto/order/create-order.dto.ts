import { CreateOrderItemDto } from "../order-item/create-order-item.dto.ts";

export class CreateOrderDto {
  userSuperTokensId: number;
  totalPrice: number;
  totalItems: number;
  paymentType: string;
  status: string;
  orderItems: CreateOrderItemDto[] = [];

  constructor(
    userSuperTokensId: number,
    totalPrice: number,
    totalItems: number,
    paymentType: string,
    status: string,
    orderItems: CreateOrderItemDto[],
  ) {
    this.userSuperTokensId = userSuperTokensId;
    this.totalPrice = totalPrice;
    this.totalItems = totalItems;
    this.paymentType = paymentType;
    this.status = status;
    this.orderItems = orderItems;
  }
}
