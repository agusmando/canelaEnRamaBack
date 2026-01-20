import { UserDto } from "../user/user.dto.ts";
import { CartItemDto } from "../cart-item/cart-item.dto.ts";


export class CartDto {
  id: number;
  sessionId?: string;
  userSuperTokensId?: number;
  user?: UserDto;
  items: CartItemDto[];
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: number,
    items: CartItemDto[],
    createdAt: Date,
    updatedAt: Date,
    sessionId?: string,
    userSuperTokensId?: number,
    user?: UserDto,
  ) {
    this.id = id;
    this.items = items;
    this.sessionId = sessionId;
    this.user = user;
    this.userSuperTokensId = userSuperTokensId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
