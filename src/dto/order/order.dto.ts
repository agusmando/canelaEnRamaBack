import { OrderStatus } from "../enums/order-status.enum.ts";
import { UserDto } from "../user/user.dto.ts";
import { OrderItemDto } from "../order-item/order-item.dto.ts";

/*
id                Int      @id @default(autoincrement())
  userSuperTokensId String
  user              User?    @relation(fields: [userSuperTokensId], references: [supertokensId])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  totalPrice  Float
  totalItems  Int
  paymentType String

  // Usar un Enum o mantener tu modelo OrderStatus
  status     OrderStatus @default(PENDING)
  orderItems OrderItem[]
*/
export class OrderDto {
  id: number;
  userSuperTokensId?: number;
  user: UserDto;
  createdAt: Date;
  updatedAt: Date;

  totalPrice: number;
  totalItems: number;
  paymentType: string;

  status: OrderStatus;
  orderItems: OrderItemDto[];
  constructor(
    id: number,
    createdAt: Date,
    updatedAt: Date,
    userSuperTokensId: number,
    user: UserDto,
    totalPrice: number,
    totalItems: number,
    paymentType: string,
    status: OrderStatus,
    orderItems: OrderItemDto[],
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
  }
}
