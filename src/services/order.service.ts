import { GenericServiceImpl } from "./generic-impl.service.ts";
import { OrderDto } from "../dto/order/order.dto.ts";
import { CreateOrderDto } from "../dto/order/create-order.dto.ts";
import { UpdateOrderDto } from "../dto/order/update-order.dto.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { OrderRepository } from "../repository/order.repository.ts";
import { ProductVariantService } from "./product-variant.service.ts";
import { CreateOrderItemDto } from "../dto/order-item/create-order-item.dto.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.ts";
import { OrderItemService } from "./order-item.service.ts";
import { OrderItemDto } from "../dto/order-item/order-item.dto.ts";
import { StockMovementService } from "./stockMovement.service.ts";

export class OrderService extends GenericServiceImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  protected orderRepository: OrderRepository;
  private productVariantService: ProductVariantService;
  private stockMovementService: StockMovementService;
  private orderItemService: OrderItemService;
  constructor() {
    super("order");
    this.orderRepository = new OrderRepository();
    this.productVariantService = new ProductVariantService();
    this.orderItemService = new OrderItemService();
    this.stockMovementService = new StockMovementService();
  }

  async createOrder(data: CreateOrderDto, sessionId: string): Promise<any> {
    if (data.orderItems.length == 0) {
      throw new ValidationError("Order must have at least one item");
    }
    if (!sessionId || sessionId == "") {
      throw new ValidationError("Session id is required");
    }

    let awaitingStockAt: Date = new Date();
    let currentDate: Date = new Date(awaitingStockAt);
    const itemsForCreation: Promise<CreateOrderItemDto>[] = data.orderItems.map(
      async (item) => {
        const productVariant = await this.productVariantService.findOne(
          item.productVariantId,
        );
        if (!productVariant) {
          throw new ValidationError(
            "Product variant with id " + item.productVariantId + " not found",
          );
        }

        if (productVariant.requestTime !== null) {
          const days = Number(productVariant.requestTime) || 0;
          const awaitingDate = new Date();
          awaitingDate.setDate(awaitingDate.getDate() + days);
          item.awaitingStockAt = awaitingDate;
        }

        if (item.awaitingStockAt && item.awaitingStockAt > awaitingStockAt) {
          awaitingStockAt = item.awaitingStockAt;
        }

        return {
          quantity: item.quantity,
          productVariantId: item.productVariantId,
          productNameSnapshot: productVariant.product?.name || "",
          variantNameSnapshot: productVariant.name,
          unitPriceSnapshot: productVariant.finalPrice || 0,
          status: "FULFILLED",
          awaitingStockAt: item.awaitingStockAt,
        };
      },
    );

    const orderItems = await Promise.all(itemsForCreation);
    const totalPrice = await this.calculateTotalPrice(orderItems);

    let createOrderDto: CreateOrderDto = {
      userSuperTokensId: sessionId,
      totalPrice,
      totalItems: itemsForCreation.length,
      paymentType: "DEBIT",
      status: "PENDING",
      orderItems,
      estimatedReadyAt:
        awaitingStockAt > currentDate ? awaitingStockAt : undefined,
    };

    const response = await this.orderRepository.create(createOrderDto);
    if (response) {
      orderItems.forEach(async (item: any) => {
        await this.updateItemStock(item.productVariantId, item.quantity, 0);
      });
    }
    return response;
  }

  async getOrder(id: number) {
    return await this.orderRepository.getOrder(id);
  }

  async updateOrder(id: number, data: UpdateOrderDto) {
    if (!id || id == 0) { 
      throw new NotFoundError();
    }
    const currentOrder = await this.getOrder(id);
    console.log("data", data);

    if (currentOrder.status === "CANCELLED") {
      throw new ValidationError("Order is already cancelled");
    }

    if (data.status) {
      currentOrder.status = data.status;
      if (data.status === "CANCELLED") {
        currentOrder.orderItems.forEach(async (item: any) => {
          return await this.applyItemChange(currentOrder, {
            productVariantId: item.productVariantId,
            status: "CANCELLED",
          } as UpdateOrderItemDto);
        });
        return await this.orderRepository.update(id, currentOrder);
      }
    }

    if (data.editItem && data.editItem.length > 0) {
      for (let item of data.editItem) {
        if (!item.productVariantId) {
          throw new ValidationError(
            "Product variant id is required for adding items",
          );
        }
        await this.applyItemChange(currentOrder, item);
      }
      currentOrder.totalPrice = this.calculateTotalPrice(
        currentOrder.orderItems,
      );
      this.recalculateOrderStatus(currentOrder);
    }

    console.log("currentOrder", currentOrder);
    // if data.status === confirmed (resto el stock con el servicio de StockMovement)
    return await this.orderRepository.update(id, currentOrder);
  }

  async applyItemChange(order: OrderDto, item: UpdateOrderItemDto) {
    console.log("item", item);
    let currentItem = order.orderItems.find(
      (i) => i.productVariantId == item.productVariantId,
    );
    console.log("currentItem", currentItem);

    if (!currentItem) {
      throw new ValidationError(
        "Item with id " + item.productVariantId + " not found in order",
      );
    }

    let itemData: any = {};

    if (item.status) {
      itemData.status = item.status;
    }
    if (item.quantity != null) {
      if (
        currentItem.quantity < item.quantity ||
        item.quantity === currentItem.quantity
      ) {
        return new ValidationError(
          "Quantity must be lower than current quantity",
        );
      }
      itemData.quantity = Number(item.quantity);
      itemData.status = item.quantity == 0 ? "RETURNED" : "PARTIALLY_RETURNED";
      this.updateItemStock(
        currentItem.productVariantId,
        item.quantity,
        currentItem.quantity,
      );
    }
    if (item.awaitingStockAt) {
      itemData.awaitingStockAt = item.awaitingStockAt;
      itemData.status = "AWAITING_STOCK";
      if (
        order.estimatedReadyAt &&
        new Date(item.awaitingStockAt) > order.estimatedReadyAt
      ) {
        order.estimatedReadyAt = item.awaitingStockAt;
      }
    }
    if (itemData && Object.keys(itemData).length > 0) {
      // await this.orderItemService.update(item.id, itemData);
      const index = order.orderItems.findIndex(
        (i) => i.productVariantId == item.productVariantId,
      );
      order.orderItems[index] = {
        ...order.orderItems[index],
        ...itemData,
      };

      await this.orderRepository.editItemOfOrder(
        order.orderItems[index].id,
        order.orderItems[index],
      );

      console.log("order.orderItems[index]", order.orderItems[index]);
    }
  }

  private recalculateOrderStatus(order: OrderDto) {
    const activeItems = order.orderItems.filter(
      (i) => i.status !== "CANCELLED" && i.status !== "RETURNED",
    );

    if (activeItems.length === 0) {
      order.status = "CANCELLED";
      return;
    }

    if (activeItems.length < order.orderItems.length) {
      order.status = "PROCESSING";
      return;
    }

    order.status = "PROCESSING";
  }

  private calculateTotalPrice(orderItems: any[]) {
    return orderItems.reduce((total, item) => {
      return total + item.unitPriceSnapshot * item.quantity;
    }, 0);
  }

  private async updateItemStock(
    productVariantId: number,
    oldQuantity: number,
    newQty?: number,
  ) {
    if (newQty == null) {
      throw new ValidationError("New quantity is required for updating stock");
    }

    const diff = newQty - oldQuantity;

    if (diff === 0) return;

    await this.stockMovementService.createStockMovement(
      productVariantId,
      diff,
      diff < 0 ? "OUT" : "RETURN",
    );
  }
}
