import { CartItemRepository } from "./cart-item.repository.js";
import { PrismaClient } from "@prisma/client";
import { CartDto } from "../dto/cart/cart.dto.js";
import { CreateCartDto } from "../dto/cart/create-cart.dto.js";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.js";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { cartUpdateMapping } from "../mappings/cart/cart-update.mapping.js";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.js";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";
import { UpdateCartItemDto } from "../dto/cart-item/update-cart-item.dto.js";
import { DatabaseError } from "../errors/infra/DatabaseError.js";

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

  async create(createData: CreateCartDto, tx?: PrismaClient): Promise<any> {
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

    let cart = await super.create(data, tx);

    return cart;
  }

  async getCart(value: string, tx?: PrismaClient): Promise<any> {
    console.log("value", value);
    try {
      const model = tx ?? this.prisma;
      return await model.cart.findFirst({
        where: { OR: [{ sessionId: value }, { userSuperTokensId: value }] },
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async updateCart(cartToken: string, data: UpdateCartDto): Promise<any> {
    const updateMapping = cartUpdateMapping;

    const updateData = prismaUpdateEntityBuilder(data, updateMapping);

    console.log("updateData", updateData);

    return await this.prisma.cart.update({
      where: { sessionId: cartToken },
      data: updateData,
    });
  }

  async deleteCart(cartToken: string, tx?: PrismaClient): Promise<any> {
    const model = tx ?? this.prisma;
    return await model.cart.deleteMany({
      where: {
        OR: [{ sessionId: cartToken }, { userSuperTokensId: cartToken }],
      },
    });
  }

  async mergeSessionCartToUserCart(
    sessionId: string,
    userSuperTokensId: string,
    tx?: PrismaClient,
  ) {
    try {
      const model = tx ?? this.prisma;
      await model
        .$executeRaw`SELECT public.merge_session_cart_to_user_cart(${sessionId}::VARCHAR, ${userSuperTokensId}::VARCHAR)`;
      return this.updateTimeOnCart(userSuperTokensId);
    } catch (error: any) {
      throw new StoreProcedureError("merge_session_cart_to_user_cart", error);
    }
  }

  async addItemsToCart(cartToken: string, items: UpdateCartItemDto[], tx?: PrismaClient) {
    try {
      const promises: Promise<any>[] = [];
      const model = tx ?? this.prisma;
      items.forEach(async (item) => {
        promises.push(
          model
            .$executeRaw`SELECT public.add_item_to_cart(${cartToken}::VARCHAR, ${item.productVariantId}::INT, ${item.quantity}::INT)`,
        );
        return Promise.all(promises);
      });
    } catch (error: any) {
      throw new StoreProcedureError("add_item_to_cart", error);
    }
  }

  async removeItemsFromCart(
    cartToken: string,
    items: { productVariantId: number }[],
    tx?: PrismaClient
  ) {
    try {
      const currentCart = await this.getCart(cartToken);
      const promises: Promise<any>[] = [];
      const model = tx ?? this.prisma;
      items.forEach(async (item) => {
        promises.push(
          model.cartItem.deleteMany({
            where: {
              cartId: currentCart.id,
              productVariantId: item.productVariantId,
            },
          }),
        );
      });
      await Promise.all(promises);

      return this.updateTimeOnCart(cartToken);
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async editItemOfCart(cartToken: string, items: UpdateCartItemDto[], tx?: PrismaClient) {
    try {
      const currentCart = await this.getCart(cartToken);
      const promises: Promise<any>[] = [];
      const model = tx ?? this.prisma;
      items.forEach(async (item) => {
        if (item.quantity === 0) {
          promises.push(
            model.cartItem.deleteMany({
              where: {
                cartId: currentCart.id,
                productVariantId: item.productVariantId,
              },
            }),
          );
        }
        promises.push(
          model.cartItem.updateMany({
            where: {
              cartId: currentCart.id,
              productVariantId: item.productVariantId,
            },
            data: {
              quantity: item.quantity,
            },
          }),
        );
      });
      await Promise.all(promises);
      return this.updateTimeOnCart(cartToken);
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async updateTimeOnCart(cartToken: string, tx?: PrismaClient) {
    try {
      const currentCart = await this.getCart(cartToken);
      const model = tx ?? this.prisma;
      return await model.cart.update({
        where: { id: currentCart.id },
        data: { updatedAt: new Date() },
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  product: true,
                },
              }
            },
          },
        },
      });
    } catch (error: any) {
      throw new StoreProcedureError("update_time_on_cart", error);
    }
  }
}
