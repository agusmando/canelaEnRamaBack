
import { OrderItemRepository } from "./order-item.repository.ts";
import { PrismaClient } from "@prisma/client";
import { OrderDto } from "../dto/order/order.dto.ts";
import { CreateOrderDto } from "../dto/order/create-order.dto.ts";
import { UpdateOrderDto } from "../dto/order/update-order.dto.ts";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { orderCreateMapping } from "../mappings/order/order-create.mapping.ts";
import { OrderItemService } from "../services/order-item.service.ts";
import { orderUpdateMapping } from "../mappings/order/order-update.mapping.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.ts";
import { DatabaseError } from "../errors/infra/DatabaseError.ts";

export class OrderRepository extends GenericRepositoryImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  protected prisma: PrismaClient;
  protected orderItemRepository: OrderItemRepository;
  constructor() {
    super("order");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.orderItemRepository = new OrderItemRepository();
  }

  async create(createData: CreateOrderDto): Promise<any> {

    // const finalQuery = prismaCreateEntityBuilder(createData, mapping);
    // const data: any = {
    //   ...createData,
    //   orderItems: { create: orderItems },
    // };

    // console.log("data", data);

    return await super.create(createData);
  }

  async getOrder(value: string): Promise<any> {
    console.log("value", value);
    try {
      return await this.prisma.order.findFirst({
        where: { OR: [{ sessionId: value }, { userSuperTokensId: value }] },
        include: {
          orderItems: {
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

  async updateOrder(orderToken: string, data: UpdateOrderDto): Promise<any> {
    const updateMapping = orderUpdateMapping;

    const updateData = prismaUpdateEntityBuilder(data, updateMapping);

    console.log("updateData", updateData);

    return await this.prisma.order.update({
      where: { sessionId: orderToken },
      data: updateData,
    });
  }

  async deleteOrder(orderToken: string): Promise<any> {
    return await this.prisma.order.deleteMany({
      where: {
        OR: [{ sessionId: orderToken }, { userSuperTokensId: orderToken }],
      },
    });
  }

  async mergeSessionOrderToUserOrder(
    sessionId: string,
    userSuperTokensId: string,
  ) {
    try {
      await this.prisma
        .$executeRaw`SELECT public.merge_session_order_to_user_order(${sessionId}::VARCHAR, ${userSuperTokensId}::VARCHAR)`;
      return this.updateTimeOnOrder(userSuperTokensId);
    } catch (error) {
      throw new StoreProcedureError("merge_session_order_to_user_order");
    }
  }

  async addItemsToOrder(orderToken: string, orderItems: UpdateOrderItemDto[]) {
    try {
      const promises: Promise<any>[] = [];
      orderItems.forEach(async (item) => {
        promises.push(
          this.prisma
            .$executeRaw`SELECT public.add_item_to_order(${orderToken}::VARCHAR, ${item.productVariantId}::INT, ${item.quantity}::INT)`,
        );
        return Promise.all(promises);
      });
    } catch (error) {
      throw new StoreProcedureError("add_item_to_order");
    }
  }

  async removeItemsFromOrder(
    orderToken: string,
    orderItems: { productVariantId: number }[],
  ) {
    try {
      const currentOrder = await this.getOrder(orderToken);
      const promises: Promise<any>[] = [];
      orderItems.forEach(async (item) => {
        promises.push(
          this.prisma.orderItem.deleteMany({
            where: {
              orderId: currentOrder.id,
              productVariantId: item.productVariantId,
            },
          }),
        );
      });
      await Promise.all(promises);

      return this.updateTimeOnOrder(orderToken);
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async editItemOfOrder(orderToken: string, orderItems: UpdateOrderItemDto[]) {
    try {
      const currentOrder = await this.getOrder(orderToken);
      const promises: Promise<any>[] = [];
      orderItems.forEach(async (item) => {
        if (item.quantity === 0) {
          promises.push(
            this.prisma.orderItem.deleteMany({
              where: {
                orderId: currentOrder.id,
                productVariantId: item.productVariantId,
              },
            }),
          );
        }
        promises.push(
          this.prisma.orderItem.updateMany({
            where: {
              orderId: currentOrder.id,
              productVariantId: item.productVariantId,
            },
            data: {
              quantity: item.quantity,
            },
          }),
        );
      });
      await Promise.all(promises);
      return this.updateTimeOnOrder(orderToken);
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async updateTimeOnOrder(orderToken: string) {
    try {
      const currentOrder = await this.getOrder(orderToken);
      return await this.prisma.order.update({
        where: { id: currentOrder.id },
        data: { updatedAt: new Date() },
        include: {
          orderItems: {
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
    } catch (error) {
      throw new StoreProcedureError("update_time_on_order");
    }
  }
}
