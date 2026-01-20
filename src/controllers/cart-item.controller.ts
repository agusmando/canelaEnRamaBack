import { CartItemDto } from "../dto/cart-item/cart-item.dto.ts";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.ts";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.ts";
import { CartItemService } from "../services/cart-item.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";


export class CartItemController extends GenericControllerImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  cartItemService: CartItemService;
  constructor() {
    super("cartItem");
    this.cartItemService = new CartItemService();
  }

//   async addCartItemProducts(req: any, res: any, next: any) {
//     try {
//       const cartItemId: number = req.params.id;
//       const response = await this.cartItemService.addRemoveProducts(
//         Number(cartItemId),
//         req.body,
//         true
//       );
//       res
//         .status(200)
//         .json(new BaseResponse(200, "CartItem products added", response));
//     } catch (error) {
//       next(error);
//     }
//   }

//   async removeCartItemProducts(req: any, res: any, next: any) {
//     try {
//       const cartItemId: number = req.params.id;
//       const response = await this.cartItemService.addRemoveProducts(
//         Number(cartItemId),
//         req.body,
//         false
//       );
//       res
//         .status(200)
//         .json(new BaseResponse(200, "CartItem products removed", response));
//     } catch (error) {
//       next(error);
//     }
//   }
}
