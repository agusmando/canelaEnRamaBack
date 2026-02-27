import { OrderItemRepository } from "./order-item.repository.ts";
import { PrismaClient } from "@prisma/client";
import { OrderDto } from "../dto/order/order.dto.ts";
import { CreateOrderDto } from "../dto/order/create-order.dto.ts";
import { UpdateOrderDto } from "../dto/order/update-order.dto.ts";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.ts";
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

  async getOrder(id: number, tx?: PrismaClient): Promise<any> {
    console.log("id", id);
    try {
      const model = tx ?? this.prisma;
      return await model.order.findFirst({
        where: { id },
        include: {
          orderItems: {
            include: {
              productVariant: {
                include: {
                  product: true,
                  offers: true
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
  
  async deleteOrder(id: number, tx?: PrismaClient): Promise<any> {
    const model = tx ?? this.prisma;
    return await model.order.deleteMany({
      where: {
        id,
      },
    });
  }

  async updateOrder(id: number, data: UpdateOrderItemDto, tx?: PrismaClient) {
    try {
      await super.update(id, data, tx);
      return this.updateTimeOnOrder(id, tx);
    } catch (error) {
      throw new DatabaseError();
    }
  }

  async updateTimeOnOrder(id: number, tx?: PrismaClient) {
    try {
      const currentOrder = await this.getOrder(id);
      const model = tx ?? this.prisma;
      return await model.order.update({
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
    } catch (error: any) {
      throw new StoreProcedureError("update_time_on_order", error);
    }
  }

  async editItemOfOrder(id: number, data: UpdateOrderItemDto, tx?: PrismaClient) {
    if (!id || id == 0) {
      throw new NotFoundError();
    }
    if (!data.productVariantId) {
      throw new ValidationError("Product variant id is required for updating order item");
    }
    return await this.orderItemRepository.update(id, data, tx);
  }
}
