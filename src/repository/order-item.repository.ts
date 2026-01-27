import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { OrderItemDto } from "../dto/order-item/order-item.dto.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { orderItemCreateMapping } from "../mappings/order-item/order-item-create.mapping.ts";

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
  async createBaseItemQuery(
    items: CreateOrderItemDto[],
  ): Promise<any> {
    const orderItemMapping = orderItemCreateMapping;
    let result: any;
    items?.forEach((item: any) => {
      const basic = prismaCreateEntityBuilder(item, orderItemMapping);
      result = {
        ...basic,
      };
    });
    console.log("result" ,result)
    return result;
  }
}
