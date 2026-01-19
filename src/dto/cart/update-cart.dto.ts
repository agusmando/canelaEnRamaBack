import { CreateCartItemDto } from "../cart-item/create-cart-item.dto.ts";

export class UpdateCartDto {
  sessionId?: string;
  userId?: number;
  addItem?: CreateCartItemDto[];
  removeItem?: number[];
  constructor(
    sessionId?: string,
    userId?: number,
    addItem?: CreateCartItemDto[],
    removeItem?: number[],
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.addItem = addItem;
    this.removeItem = removeItem;
  }
}
