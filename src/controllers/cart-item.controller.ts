import { CartItemDto } from "../dto/cart-item/cart-item.dto.js";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.js";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.js";
import { CartItemRepository } from "../repository/cart-item.repository.js";
import { GenericServiceImpl } from "../services/generic-impl.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

export class CartItemController extends GenericControllerImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  constructor() {
    super(new GenericServiceImpl(new CartItemRepository()));
  }
}
