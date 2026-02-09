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
import { ValidationError } from "../errors/application/ValidationError.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";

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

  async getOrder(id: number): Promise<any> {
    console.log("id", id);
    try {
      return await this.prisma.order.findFirst({
        where: { id },
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

  // async updateOrder(orderToken: string, data: UpdateOrderDto): Promise<any> {
  //   const updateMapping = orderUpdateMapping;

  //   const updateData = prismaUpdateEntityBuilder(data, updateMapping);

  //   console.log("updateData", updateData);

  //   return await this.prisma.order.update({
  //     where: { sessionId: orderToken },
  //     data: updateData,
  //   });
  // }

  async deleteOrder(id: number): Promise<any> {
    return await this.prisma.order.deleteMany({
      where: {
        id,
      },
    });
  }

  async update(id: number, data: UpdateOrderItemDto) {
    try {
      await super.update(id, data);
      return this.updateTimeOnOrder(id);
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async updateTimeOnOrder(id: number) {
    try {
      const currentOrder = await this.getOrder(id);
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
              },
            },
          },
        },
      });
    } catch (error) {
      throw new StoreProcedureError("update_time_on_order");
    }
  }


  async editItemOfOrder(id: number, data: UpdateOrderItemDto) {
    if (!id || id == 0) {
      throw new NotFoundError();
    }
    if (!data.productVariantId) {
      throw new ValidationError();
    }
    return await this.orderItemRepository.update(id, data);
  }

}
