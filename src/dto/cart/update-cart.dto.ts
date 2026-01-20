import { CreateCartItemDto } from "../cart-item/create-cart-item.dto.ts";

export class UpdateCartDto {
  sessionId?: string;
  userSuperTokensId?: string;
  addItem?: CreateCartItemDto[];
  removeItem?: number[];
  constructor(
    sessionId?: string,
    userSuperTokensId?: string,
    addItem?: CreateCartItemDto[],
    removeItem?: number[],
  ) {
    this.sessionId = sessionId;
    this.userSuperTokensId = userSuperTokensId;
    this.addItem = addItem;
    this.removeItem = removeItem;
  }
}
