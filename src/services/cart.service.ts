import { GenericServiceImpl } from "./generic-impl.service.ts";
import { CartDto } from "../dto/cart/cart.dto.ts";
import { CreateCartDto } from "../dto/cart/create-cart.dto.ts";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { CartRepository } from "../repository/cart.repository.ts";
import { v4 as uuidv4 } from 'uuid';

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
    console.log("data", data)
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
      throw new NotFoundError();
    }
    if (data.userSuperTokensId) {
      const loggedInCart = await this.cartRepository.getCart(data.userSuperTokensId);
      const currentCart = await this.cartRepository.getCart(sessionId);
      if (currentCart && !currentCart.userSuperTokensId) { //Si el carrito existe y tiene un sessionId (no userSuperTokensId)

      }

      //Acá tiene que suceder algo. Si el usuario se loguea y ya tenía un carrito y vos
      //tenías un carrito sin loguearte, hay que mergear ambos carritos. El carrito que queda
      //es el de userSuperTokensId. Se elimina el de sessionId después de haber hecho un update 
      //a cart item. El caso fácil es cuando todos los items son diferentes, simplemente cambia 
      //el cartId de esos items y elimina el cart con sessionId

      //hace falta discontinuar el id del carrito y empezar a usar tokens

      //El caso difícil es cuando existe el mismo item en los dos carritos. habría que crear un 
      //SP que revise que pasa con el token de usuario logueado y el sessionId. Si se repite, suma
      //las cantidades y elimina el carrito de sessionId.
    } 
    return await this.cartRepository.updateCart(sessionId, data);
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
