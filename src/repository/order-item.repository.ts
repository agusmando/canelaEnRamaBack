import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { OrderItemDto } from "../dto/order-item/order-item.dto.js";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.js";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.js";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.js";
import { orderItemCreateMapping } from "../mappings/order-item/order-item-create.mapping.js";
import { DatabaseError } from "../errors/infra/DatabaseError.js";

export class OrderItemRepository extends GenericRepositoryImpl<
  OrderItemDto,
  CreateOrderItemDto,
  UpdateOrderItemDto
> {
  protected prisma: PrismaClient;
  // protected imageService: ImageService;
  constructor() {
    super("orderItem");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  /**
   * Create a query for the product variant
   * @param items Order items to create
   * @returns A query for the order item
   */
  // async createBaseItemQuery(
  //   items: CreateOrderItemDto[],
  // ): Promise<any> {
  //   let result: any[] = [];
  //   // items?.forEach((item: any) => {
  //   //   const basic = prismaCreateEntityBuilder(item, orderItemCreateMapping);
  //   //   console.log("individual" ,basic)

  //   //   result.push(basic);
  //   // });
  //   return {
  //     create: items
  //   };
  // }

  async update(id: number, data: UpdateOrderItemDto, tx?: PrismaClient) {
    try {
      await super.update(id, data);
    } catch (error) {
      throw new DatabaseError();
    }
  }
}
