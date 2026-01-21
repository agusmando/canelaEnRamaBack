import { CartDto } from "../dto/cart/cart.dto.ts";
import { CreateCartDto } from "../dto/cart/create-cart.dto.ts";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.ts";
import { CartService } from "../services/cart.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

export class CartController extends GenericControllerImpl<
  CartDto,
  CreateCartDto,
  UpdateCartDto
> {
  cartService: CartService;
  constructor() {
    super("cart");
    this.cartService = new CartService();
  }

  async create(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const sessionId = req.session?.userId;
      // console.log("sessionId", sessionId)
      const response = await this.cartService.createCart(data, sessionId);
      if (!response.userSuperTokensId) {
        res.cookie("guest_cart_id", response.sessionId, {
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24 * 10, // 10 días
        });
      }
      res.status(201).json(new BaseResponse(200, "Cart created", response));
    } catch (error) {
      next(error);
    }
  }
   
  async findOne(req: any, res: any, next: any) {
    //  req.session?.userId || req.cookies.guest_cart_id
    const sessionId = req.params.id; // token completo del carrito
    const response = await this.cartService.getCart(sessionId);
    res.status(200).json(new BaseResponse(200, "Cart found", response));
  }

  async update(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const sessionId = req.params.id;
      const response = await this.cartService.updateCart(sessionId, data);
      res.status(201).json(new BaseResponse(201, "Cart updated", response));
    } catch (error) {
      next(error);
    }
  } 

  //   async addCartProducts(req: any, res: any, next: any) {
  //     try {
  //       const cartId: number = req.params.id;
  //       const response = await this.cartService.addRemoveProducts(
  //         Number(cartId),
  //         req.body,
  //         true
  //       );
  //       res
  //         .status(200)
  //         .json(new BaseResponse(200, "Cart products added", response));
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   async removeCartProducts(req: any, res: any, next: any) {
  //     try {
  //       const cartId: number = req.params.id;
  //       const response = await this.cartService.addRemoveProducts(
  //         Number(cartId),
  //         req.body,
  //         false
  //       );
  //       res
  //         .status(200)
  //         .json(new BaseResponse(200, "Cart products removed", response));
  //     } catch (error) {
  //       next(error);
  //     }
  //   }
}
