import { CartDto } from "../dto/cart/cart.dto.js";
import { CreateCartDto } from "../dto/cart/create-cart.dto.js";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.js";
import { CartService } from "../services/cart.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";
import { getActor } from "../middleware/auth.middleware.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";

const GUEST_COOKIE = "guest_cart_id";

const readCookie = (req: any, name: string): string | undefined => {
  const header: string = req.headers?.cookie ?? "";
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
};

export class CartController extends GenericControllerImpl<CartDto, CreateCartDto, UpdateCartDto> {
  readonly cartService: CartService;

  constructor(cartService = new CartService()) {
    super(cartService);
    this.cartService = cartService;
  }

  async create(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const response = await this.cartService.createCart(req.body, actor.userId);
      if (!response.userSuperTokensId) {
        res.cookie(GUEST_COOKIE, response.sessionId, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 1000 * 60 * 60 * 24 * 10, // 10 días
        });
      }
      res.status(201).json(new BaseResponse(201, "Cart created", response));
    } catch (error) {
      next(error);
    }
  }

  /** GET /cart/me — carrito del usuario logueado o del invitado (cookie). */
  async findMine(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const token = actor.userId ?? readCookie(req, GUEST_COOKIE);
      if (!token) throw new NotFoundError("Cart not found");
      const response = await this.cartService.getCart(token, actor);
      res.status(200).json(new BaseResponse(200, "Cart found", response));
    } catch (error) {
      next(error);
    }
  }

  /** GET /cart/:token — token = sessionId (invitado) o id de usuario. */
  async findOne(req: any, res: any, next: any) {
    try {
      const response = await this.cartService.getCart(req.params.id, getActor(req));
      res.status(200).json(new BaseResponse(200, "Cart found", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.cartService.updateCart(req.params.id, req.body, getActor(req));
      if (req.body?.mergeGuestCart || req.body?.userSuperTokensId) {
        res.clearCookie(GUEST_COOKIE);
      }
      res.status(200).json(new BaseResponse(200, "Cart updated", response));
    } catch (error) {
      next(error);
    }
  }
}
