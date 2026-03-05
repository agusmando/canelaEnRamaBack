import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { CartItemDto } from "../dto/cart-item/cart-item.dto.js";
import { CreateCartItemDto } from "../dto/cart-item/create-cart-item.dto.js";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.js";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.js";
import { cartItemCreateMapping } from "../mappings/cart-item/cart-item-create.mapping.js";

export class CartItemRepository extends GenericRepositoryImpl<
  CartItemDto,
  CreateCartItemDto,
  UpdateCartItemDto
> {
  protected prisma: PrismaClient;
  // protected imageService: ImageService;
  constructor() {
    super("cartItem");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  /**
   * Create a query for the product variant
   * @param items Cart items to create
   * @returns A query for the cart item
   */
  async createBaseItemQuery(
    items: CreateCartItemDto[],
  ): Promise<any> {
    const cartItemMapping = cartItemCreateMapping;
    let result: any;
    items?.forEach((item: any) => {
      const basic = prismaCreateEntityBuilder(item, cartItemMapping);
      result = {
        ...basic,
      };
    });
    console.log("result" ,result)
    return result;
  }
}
