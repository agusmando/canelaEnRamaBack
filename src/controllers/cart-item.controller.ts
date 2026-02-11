import { CartItemDto } from "../dto/cart-item/cart-item.dto.ts";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.ts";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";


export class CartItemController extends GenericControllerImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  constructor() {
    super("cartItem");
  }
}
