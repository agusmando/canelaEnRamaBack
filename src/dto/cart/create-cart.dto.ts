import { CreateCartItemDto } from "../cart-item/create-cart-item.dto.ts";

export class CreateCartDto {

  sessionId?: string;
  userSuperTokensId?: string;
  items: CreateCartItemDto[] = [];
  constructor( 
    sessionId?: string,
    userSuperTokensId?: string,
    items: CreateCartItemDto[] = [],
  ) {
    this.sessionId = sessionId;
    this.userSuperTokensId = userSuperTokensId;
    this.items = items;
  }
}
