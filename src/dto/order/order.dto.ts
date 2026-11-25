
import { UserDto } from "../user/user.dto.js";
import { OrderItemDto } from "../order-item/order-item.dto.js";
export class OrderDto {
  id: number;
  userSuperTokensId?: string;
  user: UserDto;
  createdAt: Date;
  updatedAt: Date;

  totalPrice: number;
  totalItems: number;
  paymentType: string;
  paymentStatus?: string;
  paymentStatusDetail?: string | null;
  paymentId?: string | null;
  paymentPreferenceId?: string | null;
  paidAt?: Date | null;
  refundId?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  refundNote?: string | null;
  refundedAt?: Date | null;
  refundEmailId?: string | null;
  refundEmailSentAt?: Date | null;
  shippingMethod?: "DELIVERY" | "PICKUP" | null;
  shippingCost?: number;
  shippingProvider?: string | null;
  shippingZone?: string | null;
  couponCode?: string | null;
  couponDiscount?: number;
  discountCodeId?: number | null;

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
