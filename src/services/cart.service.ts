import { GenericServiceImpl } from "./generic-impl.service.ts";
import { CartDto } from "../dto/cart/cart.dto.ts";
import { CreateCartDto } from "../dto/cart/create-cart.dto.ts";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { CartRepository } from "../repository/cart.repository.ts";
import { v4 as uuidv4 } from "uuid";

export class CartService extends GenericServiceImpl<
  CartDto,
  CreateCartDto,
  UpdateCartDto
> {
  protected cartRepository: CartRepository;
  constructor() {
    super("cart");
    this.cartRepository = new CartRepository();
  }

  async createCart(data: CreateCartDto, userSession?: string): Promise<any> {
    if (!userSession) {
      data.sessionId = uuidv4();
    } else {
      data.userSuperTokensId = userSession;
    }
    console.log("data", data);
    return await this.cartRepository.create(data);
  }

  async getCart(sessionId: string) {
    if (!sessionId) {
      throw new NotFoundError();
    }
    return await this.cartRepository.getCart(sessionId);
  }

  async updateCart(sessionId: string, data: UpdateCartDto) {
    if (!sessionId) {
      throw new ValidationError();
    }
    console.log("data", data);
    if (data.userSuperTokensId) {
      return await this.cartRepository.mergeSessionCartToUserCart(
        sessionId,
        data.userSuperTokensId,
      );
    }
    if (data.addItem && data.addItem.length > 0) {
      await this.cartRepository.addItemsToCart(sessionId, data.addItem);
    }
    if (data.removeItem && data.removeItem.length > 0) {
      const response = await this.cartRepository.removeItemsFromCart(
        sessionId,
        data.removeItem,
      );
      if (response.items && response.items.length == 0) {
        this.cartRepository.deleteCart(sessionId);
      }
      return response;
    }
    if (data.editItem && data.editItem.length > 0) {
      const response = await this.cartRepository.editItemOfCart(
        sessionId,
        data.editItem,
      );
      if (response.items && response.items.length == 0) {
        this.cartRepository.deleteCart(sessionId);
      }
      return response;
    }
    return await this.cartRepository.updateTimeOnCart(sessionId);
  }
  //   async addRemoveProducts(
  //     cartId: number,
  //     productData: UpdateCartProductDto,
  //     addingProduct: boolean
  //   ): Promise<CartDto> {
  //     if (!cartId || cartId == 0) {
  //       throw new NotFoundError();
  //     }
  //     if (!productData.productsId || productData.productsId.length == 0) {
  //       throw new ValidationError();
  //     }
  //     return await this.cartRepository.addRemoveProducts(
  //       Number(cartId),
  //       productData,
  //       addingProduct
  //     );
  //   }
}
