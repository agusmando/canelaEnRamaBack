import { CartItemDto } from "../dto/cart-item/cart-item.dto.js";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.js";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";


export class CartItemController extends GenericControllerImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  constructor() {
    super("cartItem");
  }
}
