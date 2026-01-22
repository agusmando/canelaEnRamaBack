import { UpdateOrderItemDto } from "../order-item/update-order-item.dto.ts";

export class UpdateOrderDto {
  userSuperTokensId: number;
  totalPrice: number;
  totalItems: number;
  paymentType: string;
  status: string;
  editItem: UpdateOrderItemDto[];
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
