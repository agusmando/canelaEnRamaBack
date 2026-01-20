
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { CartItemDto } from "../dto/cart-item/cart-item.dto.ts";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.ts";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.ts";
import { CartItemRepository } from "../repository/cart-item.repository.ts";

export class CartItemService extends GenericServiceImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  protected cartItemRepository: CartItemRepository;
  constructor() {
    super("cartItem");
    this.cartItemRepository = new CartItemRepository();
  }

//   async addRemoveProducts(
//     cartItemId: number,
//     productData: UpdateCartItemProductDto,
//     addingProduct: boolean
//   ): Promise<CartItemDto> {
//     if (!cartItemId || cartItemId == 0) {
//       throw new NotFoundError();
//     }
//     if (!productData.productsId || productData.productsId.length == 0) {
//       throw new ValidationError();
//     }
//     return await this.cartItemRepository.addRemoveProducts(
//       Number(cartItemId),
//       productData,
//       addingProduct
//     );
//   }
}
