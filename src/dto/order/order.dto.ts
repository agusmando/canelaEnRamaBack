
import { UserDto } from "../user/user.dto.ts";
import { OrderItemDto } from "../order-item/order-item.dto.ts";
export class OrderDto {
  id: number;
  userSuperTokensId?: string;
  user: UserDto;
  createdAt: Date;
  updatedAt: Date;

  totalPrice: number;
  totalItems: number;
  paymentType: string;

  estimatedReadyAt: Date;
  status: string;
  orderItems: OrderItemDto[];
  constructor(
    id: number,
    createdAt: Date,
    updatedAt: Date,
    userSuperTokensId: string,
    user: UserDto,
    totalPrice: number,
    totalItems: number,
    paymentType: string,
    status: string,
    orderItems: OrderItemDto[],
    estimatedReadyAt: Date
  ) {
    this.id = id;
    this.user = user;
    this.userSuperTokensId = userSuperTokensId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.totalPrice = totalPrice;
    this.totalItems = totalItems;
    this.paymentType = paymentType;
    this.status = status;
    this.orderItems = orderItems;
    this.estimatedReadyAt = estimatedReadyAt;
  }
}
