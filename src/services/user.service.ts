import { UserRepository } from "../repository/user.repository.ts";

export class UserService {
  protected userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
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
