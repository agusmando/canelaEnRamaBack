import { CartItemRepository } from "./cart-item.repository.ts";
import { PrismaClient } from "@prisma/client";
import { CartDto } from "../dto/cart/cart.dto.ts";
import { CreateCartDto } from "../dto/cart/create-cart.dto.ts";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.ts";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { cartCreateMapping } from "../mappings/cart/cart-create.mapping.ts";
import { CartItemService } from "../services/cart-item.service.ts";
import { cartUpdateMapping } from "../mappings/cart/cart-update.mapping.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";

export class CartRepository extends GenericRepositoryImpl<
  CartDto,
  CreateCartDto,
  UpdateCartDto
> {
  protected prisma: PrismaClient;
  protected cartItemRepository: CartItemRepository;
  constructor() {
    super("cart");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.cartItemRepository = new CartItemRepository();
  }

  async create(createData: CreateCartDto): Promise<any> {
    const items = await this.cartItemRepository.createBaseItemQuery(
      createData.items,
    );
    console.log("items", items);

    // const finalQuery = prismaCreateEntityBuilder(createData, mapping);
    const data: any = {
      ...createData,
      items: { create: items },
    };

    console.log("data", data);

    let cart = await super.create(data);

    return cart;
  }

  async getCart(value: string): Promise<any> {
    console.log("value", value)
    return await this.prisma.cart.findFirst({
      where: { OR: [{ sessionId: value }, { userSuperTokensId: value }] },
      include: {
        items: {
          include: {
            productVariant: true,
          },
        },
      },
    });
  }

  async updateCart(cartToken: string, data: UpdateCartDto): Promise<any> {

    const updateMapping = cartUpdateMapping;

    const updateData = prismaUpdateEntityBuilder(data, updateMapping);  

    console.log("updateData", updateData)

    return await this.prisma.cart.update({
      where: { sessionId: cartToken },
      data: updateData,
    });
  }
}
