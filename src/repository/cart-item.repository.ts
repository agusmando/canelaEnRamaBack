import { GenericRepositoryImpl } from "./generic.repository.js";
import { CartItemDto } from "../dto/cart-item/cart-item.dto.js";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.js";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.js";

/** CartItem no tiene `id` (PK compuesta): solo se usa para listados de staff. */
export class CartItemRepository extends GenericRepositoryImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  constructor() {
    super("cartItem", { orderBy: { createdAt: "desc" } });
  }
}
