import { CreateCartItemDto } from "../cart-item/create-cart-item.dto.ts";

export class CreateCartDto {

  sessionId?: string;
  userId?: number;
  items: CreateCartItemDto[] = [];
  constructor( 
    sessionId?: string,
    userId?: number,
    items: CreateCartItemDto[] = [],
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.items = items;
  }
}
