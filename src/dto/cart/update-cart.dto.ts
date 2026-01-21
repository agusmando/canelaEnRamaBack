import { UpdateCartItemDto } from "../cart-item/update-cart-item.dto.ts";

export class UpdateCartDto {
  sessionId?: string;
  userSuperTokensId?: string;
  addItem?: UpdateCartItemDto[];
  removeItem?: {productVariantId: number}[];
  editItem?: UpdateCartItemDto[];
  constructor(
    sessionId?: string,
    userSuperTokensId?: string,
    addItem?: UpdateCartItemDto[],
    removeItem?: {productVariantId: number}[],
    editItem?: UpdateCartItemDto[],
  ) {
    this.sessionId = sessionId;
    this.userSuperTokensId = userSuperTokensId;
    this.addItem = addItem;
    this.removeItem = removeItem;
    this.editItem = editItem;
  }
}
