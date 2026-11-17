import { OrderDto } from "../../dto/order/order.dto.js";
import { CreateOrderDto } from "../../dto/order/create-order.dto.js";
import { UpdateOrderDto } from "../../dto/order/update-order.dto.js";
import { OrderItemDto } from "../../dto/order-item/order-item.dto.js";
import { ProductVariantMapper } from "../product-variants/product-variant.mapper.js";

export class OrderMapper {
  static toDto(dbOrder: any): OrderDto {
    if (!dbOrder) return dbOrder;

    const items = dbOrder.orderItems
      ? dbOrder.orderItems.map((item: any) => {
          return new OrderItemDto(
            item.id,
            item.orderId,
            item.productVariantId,
            item.productNameSnapshot,
            item.variantNameSnapshot,
            item.unitPriceSnapshot,
            item.quantity,
            item.status,
            item.discountAppliedSnapshot ?? 0,
            item.offerTypeSnapshot ?? "",
            item.productVariant ? ProductVariantMapper.toDto(item.productVariant) : undefined,
            undefined, // Avoid circular references
            item.awaitingStockAt ?? undefined,
            item.selectedBulkOption ?? undefined
          );
        })
      : [];

    return new OrderDto(
      dbOrder.id,
      dbOrder.createdAt,
      dbOrder.updatedAt,
      dbOrder.userSuperTokensId,
      dbOrder.user ? dbOrder.user : undefined,
      dbOrder.totalPrice,
      dbOrder.totalItems,
      dbOrder.paymentType,
      dbOrder.status,
      items,
      dbOrder.estimatedReadyAt
    );
  }

  static toPrismaCreate(dto: CreateOrderDto): any {
    const data: any = {
      userSuperTokensId: dto.userSuperTokensId,
      totalPrice: Number(dto.totalPrice),
      totalItems: Number(dto.totalItems),
      paymentType: dto.paymentType || "CASH",
      status: dto.status || "PENDING",
    };

    if (dto.estimatedReadyAt) {
      data.estimatedReadyAt = dto.estimatedReadyAt;
    }

    if (dto.orderItems && dto.orderItems.length > 0) {
      data.orderItems = {
        create: dto.orderItems.map((item) => ({
          productVariantId: item.productVariantId ? Number(item.productVariantId) : null,
          productNameSnapshot: item.productNameSnapshot,
          variantNameSnapshot: item.variantNameSnapshot,
          unitPriceSnapshot: Number(item.unitPriceSnapshot),
          discountAppliedSnapshot: Number(item.discountAppliedSnapshot ?? 0),
          offerTypeSnapshot: item.offerTypeSnapshot ?? "",
          quantity: Number(item.quantity),
          status: item.status || "FULFILLED",
          awaitingStockAt: item.awaitingStockAt ? new Date(item.awaitingStockAt) : null,
          selectedBulkOption: item.selectedBulkOption ? Number(item.selectedBulkOption) : null,
        })),
      };
    }

    return data;
  }
}
