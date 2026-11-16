import { GenericRepositoryImpl, type SearchResult } from "./generic.repository.js";
import {
  CreateShipmentDto,
  ShipmentDto,
  UpdateShipmentDto,
} from "../dto/shipment/shipment.dto.js";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.js";
import { shipmentSearchQueryMapping } from "../mappings/shipment/shipment-search.mapping.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

export const SHIPMENT_INCLUDE = {
  events: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
};

const ORDER_SUMMARY = {
  order: {
    select: {
      id: true,
      status: true,
      userSuperTokensId: true,
      totalPrice: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  },
};

export class ShipmentRepository extends GenericRepositoryImpl<
  ShipmentDto,
  CreateShipmentDto,
  UpdateShipmentDto
> {
  constructor() {
    super("shipment", { orderBy: { id: "desc" } });
  }

  /** Listado para staff: siempre con eventos; con `detalle` agrega un resumen de la orden. */
  async search(
    filters: any,
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean,
    tx?: any,
  ): Promise<SearchResult<ShipmentDto>> {
    const where = prismaQueryBuilder(filters, shipmentSearchQueryMapping);
    const page = Math.max(1, Number(currentPage) || 1);
    const perPage = Math.min(100, Math.max(1, Number(amountPerPage) || 10));
    const query: any = {
      where,
      orderBy: { id: "desc" },
      include: { ...SHIPMENT_INCLUDE, ...(detalle ? ORDER_SUMMARY : {}) },
    };
    if (paginate) {
      query.take = perPage;
      query.skip = (page - 1) * perPage;
    }
    try {
      const db = tx ?? this.prisma;
      const [totalElements, entityList] = await Promise.all([
        db.shipment.count({ where }),
        db.shipment.findMany(query),
      ]);
      return { entityList, currentPage: page, amountPerPage: perPage, totalElements };
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async getById(id: number, tx?: any): Promise<any> {
    return this.findWhere({ id: Number(id) }, tx);
  }

  async findByOrderId(orderId: number, tx?: any) {
    return this.findWhere({ orderId: Number(orderId) }, tx);
  }

  async findByTrackingCode(trackingCode: string, tx?: any) {
    return this.findWhere({ trackingCode }, tx);
  }

  private async findWhere(where: Record<string, any>, tx?: any): Promise<any> {
    try {
      return await (tx ?? this.prisma).shipment.findUnique({
        where,
        include: { ...SHIPMENT_INCLUDE, ...ORDER_SUMMARY },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async createShipment(data: Record<string, any>, firstEvent: Record<string, any>, tx?: any) {
    try {
      return await (tx ?? this.prisma).shipment.create({
        data: { ...data, events: { create: [firstEvent] } },
        include: SHIPMENT_INCLUDE,
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async updateShipment(
    id: number,
    data: Record<string, any>,
    event?: Record<string, any>,
    tx?: any,
  ) {
    try {
      return await (tx ?? this.prisma).shipment.update({
        where: { id: Number(id) },
        data: { ...data, ...(event ? { events: { create: [event] } } : {}) },
        include: SHIPMENT_INCLUDE,
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async trackingCodeExists(code: string, tx?: any) {
    const found = await (tx ?? this.prisma).shipment.findUnique({
      where: { trackingCode: code },
      select: { id: true },
    });
    return Boolean(found);
  }

  async lockOrder(orderId: number, tx: any) {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${Number(orderId)} FOR UPDATE`;
  }
}
