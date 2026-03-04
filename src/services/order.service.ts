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
import { StockMovementService } from "./stockMovement.service.ts";
import { OfferService } from "./offer.service.ts";
import { PricingService } from "./pricing.service.ts";

export class OrderService extends GenericServiceImpl<
  OrderDto,
  CreateOrderDto,
  UpdateOrderDto
> {
  protected orderRepository: OrderRepository;
  private productVariantService: ProductVariantService;
  private stockMovementService: StockMovementService;
  private offerService: OfferService;
  private pricingService: PricingService;
  constructor() {
    super("order");
    this.orderRepository = new OrderRepository();
    this.productVariantService = new ProductVariantService();
    this.stockMovementService = new StockMovementService();
    this.offerService = new OfferService();
    this.pricingService = new PricingService();
  }

  async createOrder(data: CreateOrderDto, sessionId: string): Promise<any> {
    if (data.orderItems.length == 0) {
      throw new ValidationError("Order must have at least one item");
    }
    if (!sessionId || sessionId == "") {
      throw new ValidationError("Session id is required");
    }

    return this.orderRepository.withTransaction(async (tx) => {
      let awaitingStockAt: Date = new Date();
      let currentDate: Date = new Date(awaitingStockAt);
      let totalPrice: number = 0;
      const itemsForCreation: Promise<CreateOrderItemDto>[] =
        data.orderItems.map(async (item) => {
          const productVariant = await this.productVariantService.findOne(
            item.productVariantId,
          );
          if (!productVariant) {
            throw new ValidationError(
              "Product variant with id " + item.productVariantId + " not found",
            );
          }

          // compute fulfillment for bulk/unit
          const requestedPackages = Number(item.quantity || 0);
          const selectedBulk = item.selectedBulkOption
            ? Number(item.selectedBulkOption)
            : undefined;
          const fulfillment = this.computeFulfillment(
            productVariant,
            requestedPackages,
            selectedBulk,
          );

          // apply results
          if (fulfillment.status === "CANCELLED") {
            item.status = "CANCELLED";
            item.quantity = 0;
            item.selectedBulkOption =
              fulfillment.finalSize ?? item.selectedBulkOption;
          } else {
            item.status =
              fulfillment.status === "FULFILLED"
                ? item.status || "FULFILLED"
                : "PARTIALLY_RETURNED";
            item.quantity = fulfillment.finalQty;
            if (fulfillment.finalSize != null)
              item.selectedBulkOption = fulfillment.finalSize;
          }

          // Si hay tiempo de pedido
          if (productVariant.requestTime !== "") {
            const days = Number(productVariant.requestTime) || 0;
            const awaitingDate = new Date();
            awaitingDate.setDate(awaitingDate.getDate() + days);
            item.awaitingStockAt = awaitingDate;
          }

          // Aplicar ofertas sobre el precio por paquete (finalPrice representa precio por paquete según tamaño)
          const priceInfo = await this.pricingService.priceForOrderItem({
            productVariant,
            requestedQuantity: item.quantity,
            selectedBulkOption: item.selectedBulkOption,
          });

          if (item.awaitingStockAt && item.awaitingStockAt > awaitingStockAt) {
            awaitingStockAt = item.awaitingStockAt;
          }


          totalPrice += priceInfo.totalPriceSnapshot;

          return {
            quantity: item.quantity,
            productVariantId: item.productVariantId,
            productNameSnapshot: productVariant.product?.name || "",
            variantNameSnapshot: productVariant.name,
            selectedBulkOption: item.selectedBulkOption,
            unitPriceSnapshot: priceInfo.unitPriceSnapshot,
            discountAppliedSnapshot: priceInfo.discountAppliedSnapshot,
            offerTypeSnapshot: priceInfo.offerTypeSnapshot,
            status: item.status || "FULFILLED",
            awaitingStockAt: item.awaitingStockAt,
          };
        });

      const orderItems = await Promise.all(itemsForCreation);
      await this.recalculateOrderStatus(data);

      let createOrderDto: CreateOrderDto = {
        userSuperTokensId: sessionId,
        totalPrice,
        totalItems: itemsForCreation.length,
        paymentType: "DEBIT",
        status: data.status || "PENDING",
        orderItems,
        estimatedReadyAt:
          awaitingStockAt > currentDate ? awaitingStockAt : undefined,
      };

      console.log("createOrderDto", createOrderDto);
      const response = await this.orderRepository.create(createOrderDto);
      if (response) {
        let promises: Promise<any>[] = [];
        for (const item of orderItems) {
          if (item.status !== "CANCELLED") {
            let quantity = item.selectedBulkOption
              ? item.quantity * item.selectedBulkOption
              : item.quantity;
            promises.push(
              this.updateItemStock(item.productVariantId, quantity, 0, tx),
            );
          }
        }
        await Promise.all(promises);
      }
      return response;
    });
  }

  async getOrder(id: number, tx?: any) {
    return await this.orderRepository.getOrder(id, tx);
  }

  async updateOrder(id: number, data: UpdateOrderDto) {
    if (!id || id == 0) {
      throw new NotFoundError();
    }
    return this.orderRepository.withTransaction(async (tx) => {
      const currentOrder = await this.getOrder(id, tx);
      console.log("data", data);

      if (currentOrder.status === "CANCELLED") {
        throw new ValidationError("Order is already cancelled");
      }

      if (data.status) {
        currentOrder.status = data.status;
        if (data.status === "CANCELLED") {
          currentOrder.orderItems.forEach(async (item: any) => {
            return await this.applyItemChange(
              currentOrder,
              {
                productVariantId: item.productVariantId,
                status: "CANCELLED",
              } as UpdateOrderItemDto,
              tx,
            );
          });
          return await this.orderRepository.updateOrder(id, currentOrder, tx);
        }
      }

      if (data.editItem && data.editItem.length > 0) {
        for (let item of data.editItem) {
          if (!item.productVariantId) {
            throw new ValidationError(
              "Product variant id is required for adding items",
            );
          }
          await this.applyItemChange(currentOrder, item, tx);
        }
        currentOrder.totalPrice = this.calculateTotalPrice(
          currentOrder.orderItems,
        );
        this.recalculateOrderStatus(currentOrder);
      }

      console.log("currentOrder", currentOrder);
      // if data.status === confirmed (resto el stock con el servicio de StockMovement)
      return await this.orderRepository.updateOrder(id, currentOrder, tx);
    });
  }

  async applyItemChange(order: OrderDto, item: UpdateOrderItemDto, tx?: any) {
    console.log("item", item);
    let currentItem = order.orderItems.find(
      (i) => i.productVariantId == item.productVariantId,
    );

    if (!currentItem) {
      throw new ValidationError(
        "Item with id " + item.productVariantId + " not found in order",
      );
    }

    let itemData: any = {};

    if (item.quantity != null) {
      if (
        currentItem.quantity < item.quantity ||
        item.quantity === currentItem.quantity
      ) {
        return new ValidationError(
          "Quantity must be lower than current quantity",
        );
      }

      // obtener variant para calcular tamaños si cambia presentación
      const productVariant = await this.productVariantService.findOne(
        currentItem.productVariantId,
      );
      const packaging = (productVariant?.packagingOptions || [])
        .map((p: any) => Number(p))
        .filter((n: number) => !isNaN(n))
        .sort((a: number, b: number) => a - b);

      const currentSize =
        Number(currentItem.selectedBulkOption) || packaging[0] || 1;
      const newSize =
        item.selectedBulkOption != null
          ? Number(item.selectedBulkOption)
          : currentSize;

      const currentUnits = currentItem.quantity * currentSize;
      const newUnits = Number(item.quantity) * newSize;
      const returnedUnits = currentUnits - newUnits;

      if (returnedUnits <= 0) {
        return new ValidationError("Resulting returned units must be positive");
      }

      itemData.quantity = Number(item.quantity);
      itemData.status = item.quantity == 0 ? "RETURNED" : "PARTIALLY_RETURNED";

      // devolver stock: usamos el patrón (oldQuantity = 0, newQty = returnedUnits) para movimiento RETURN
      await this.updateItemStock(
        currentItem.productVariantId,
        0,
        returnedUnits,
        tx,
      );
    }

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

      let quantity = item.selectedBulkOption
        ? item.quantity * item.selectedBulkOption
        : item.quantity;
      await this.updateItemStock(
        currentItem.productVariantId,
        quantity,
        currentItem.quantity,
        tx,
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
      // await this.orderItemService.updateRepository(item.id, itemData);
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
        tx,
      );

      console.log("order.orderItems[index]", order.orderItems[index]);
    }
  }

  private recalculateOrderStatus(order: any) {
    const activeItems = order.orderItems.filter(
      (i: any) => i.status !== "CANCELLED" && i.status !== "RETURNED",
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
      let quantity = item.selectedBulkOption
        ? (item.quantity / 1000) * item.selectedBulkOption
        : item.quantity;
      return total + item.unitPriceSnapshot * quantity;
    }, 0);
  }

  private async updateItemStock(
    productVariantId: number,
    oldQuantity: number,
    newQty?: number,
    tx?: any,
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
      tx,
    );
  }

  private computeFulfillment(
    productVariant: any,
    requestedPackages: number,
    selectedBulkOption?: number,
  ) {
    const currentStock = Number(productVariant.currentStock || 0); // unidades (g o unidades)
    const packaging = (productVariant.packagingOptions || [])
      .map((p: any) => Number(p))
      .filter((n: number) => !isNaN(n))
      .sort((a: number, b: number) => a - b);

    // Unidad/simple (no packaging)
    if (!packaging || packaging.length === 0) {
      if (currentStock === 0) {
        return { finalSize: null, finalQty: 0, status: "CANCELLED", units: 0 };
      }
      if (currentStock >= requestedPackages) {
        return {
          finalSize: null,
          finalQty: requestedPackages,
          status: "FULFILLED",
          units: requestedPackages,
        };
      }
      return {
        finalSize: null,
        finalQty: currentStock,
        status: "PARTIALLY_RETURNED",
        units: currentStock,
      };
    }

    // Producto a granel
    if (currentStock === 0) {
      return { finalSize: null, finalQty: 0, status: "CANCELLED", units: 0 };
    }

    const selectedSize = Number(selectedBulkOption) || packaging[0];
    const requestedUnits = selectedSize * requestedPackages;

    if (currentStock >= requestedUnits) {
      return {
        finalSize: selectedSize,
        finalQty: requestedPackages,
        status: "FULFILLED",
        units: requestedUnits,
      };
    }

    // Intenta con la misma presentación pero menos paquetes
    const maxSame = Math.floor(currentStock / selectedSize);
    if (maxSame >= 1) {
      return {
        finalSize: selectedSize,
        finalQty: maxSame,
        status: "PARTIALLY_RETURNED",
        units: maxSame * selectedSize,
      };
    }

    // Si no cabe ni una de la presentación seleccionada, buscar presentaciones más pequeñas
    // Elegimos la presentación más pequeña que permita al menos 1 paquete (maximiza paquetes usando la más pequeña posible)
    const possible = packaging.filter((s: number) => s <= currentStock);
    if (possible.length === 0) {
      return { finalSize: null, finalQty: 0, status: "CANCELLED", units: 0 };
    }
    const fallbackSize = possible[0]; // más pequeña que cabe
    const fallbackQty = Math.floor(currentStock / fallbackSize);
    return {
      finalSize: fallbackSize,
      finalQty: fallbackQty,
      status: "PARTIALLY_RETURNED",
      units: fallbackQty * fallbackSize,
    };
  }

  
}
