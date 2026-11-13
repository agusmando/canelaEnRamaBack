import { GenericRepositoryImpl } from "./generic.repository.js";
import { OrderDto } from "../dto/order/order.dto.js";
import { CreateOrderDto } from "../dto/order/create-order.dto.js";
import { UpdateOrderDto } from "../dto/order/update-order.dto.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

const ORDER_INCLUDE = {
  shipment: {
    include: { events: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] } },
  },
  orderItems: {
    orderBy: { id: "asc" as const },
    include: {
      productVariant: {
        select: {
          id: true,
          name: true,
          contentMeasure: true,
          packagingOptions: true,
          images: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  },
};

export class OrderRepository extends GenericRepositoryImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  constructor() {
    super("order", { orderBy: { id: "desc" } });
  }

  async getOrder(id: number, tx?: any): Promise<any> {
    try {
      return await (tx ?? this.prisma).order.findUnique({
        where: { id: Number(id) },
        include: { user: true, ...ORDER_INCLUDE },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async listByUser(userSuperTokensId: string, page = 1, perPage = 10) {
    const where = { userSuperTokensId };
    const [totalElements, entityList] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { id: "desc" },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
    ]);
    return { entityList, totalElements, currentPage: page, amountPerPage: perPage };
  }

  async createOrder(
    data: Omit<CreateOrderDto, "orderItems"> & { orderItems: any[] },
    tx?: any,
  ) {
    try {
      const { orderItems, ...order } = data;
      return await (tx ?? this.prisma).order.create({
        data: { ...order, orderItems: { create: orderItems } },
        include: ORDER_INCLUDE,
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async updateOrderFields(id: number, data: Record<string, any>, tx?: any) {
    try {
      return await (tx ?? this.prisma).order.update({
        where: { id: Number(id) },
        data,
        include: ORDER_INCLUDE,
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async updateItem(itemId: number, data: Record<string, any>, tx?: any) {
    try {
      return await (tx ?? this.prisma).orderItem.update({
        where: { id: Number(itemId) },
        data,
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }
}
