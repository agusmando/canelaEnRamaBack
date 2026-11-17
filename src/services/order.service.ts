import { GenericServiceImpl } from "./generic-impl.service.js";
import { OrderDto } from "../dto/order/order.dto.js";
import { CreateOrderDto } from "../dto/order/create-order.dto.js";
import { UpdateOrderDto } from "../dto/order/update-order.dto.js";
import { UpdateOrderItemDto } from "../dto/order-item/update-order-item.dto.js";
import { OrderRepository } from "../repository/order.repository.js";
import { ProductVariantRepository } from "../repository/product-variant.repository.js";
import { StockMovementRepository } from "../repository/stockMovement.repository.js";
import { PricingService } from "./pricing.service.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { ForbidenError } from "../errors/domain/auth/ForbidenError.js";
import type { Actor } from "../middleware/auth.middleware.js";
import { CartService } from "./cart.service.js";
import { ShipmentRepository } from "../repository/shipment.repository.js";
import { isMercadoPagoConfigured } from "../config/mercadopago.js";
import { streetLine, ShippingQuoteService, type ShippingQuote } from "./shipping-quote.service.js";
import { orderMails } from "./order-mail.service.js";
import { newTrackingCode } from "../utils/trackingCode.js";
import { getLogger } from "../config/logger.js";

const log = getLogger("order");

/** Envío resuelto antes de abrir la transacción (la cotización es una llamada externa). */
type ShippingChoice =
  | { method: "PICKUP" }
  | { method: "DELIVERY"; quote: ShippingQuote; address: any };

export const PAYMENT_TYPES = ["DEBIT", "CREDIT", "CASH", "TRANSFER", "MERCADOPAGO"];
const ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

/**
 * Ciclo de vida de una orden:
 *   PENDING     recién creada; stock reservado, esperando confirmación/pago
 *   PROCESSING  confirmada, se está preparando
 *   SHIPPED     despachada / lista para retirar
 *   DELIVERED   entregada (final; solo admite devoluciones de ítems)
 *   CANCELLED   cancelada (final; el stock ya se repuso)
 */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** El cliente solo puede cancelar mientras nadie empezó a preparar la orden. */
const CUSTOMER_CANCELLABLE = ["PENDING"];
const CLOSED_ITEM_STATUSES = ["CANCELLED", "RETURNED"];

type Fulfillment = {
  finalSize: number | null;
  finalQty: number;
  status: "FULFILLED" | "PARTIALLY_RETURNED" | "CANCELLED";
  units: number;
};

/** Unidades de stock (g o u) que representa una línea. */
const stockUnitsOf = (item: { quantity: number; selectedBulkOption?: number | null }) =>
  item.selectedBulkOption ? item.quantity * item.selectedBulkOption : item.quantity;

export class OrderService extends GenericServiceImpl<OrderDto, CreateOrderDto, UpdateOrderDto> {
  constructor(
    private readonly orderRepository = new OrderRepository(),
    private readonly variantRepository = new ProductVariantRepository(),
    private readonly stockRepository = new StockMovementRepository(),
    private readonly pricingService = new PricingService(),
    private readonly cartService = new CartService(),
    private readonly shipmentRepository = new ShipmentRepository(),
    private readonly shippingQuotes = new ShippingQuoteService(),
  ) {
    super(orderRepository);
  }

  /**
   * Crea una orden para el usuario logueado.
   *
   * Todo ocurre en UNA transacción: se bloquean las variantes, se ajusta cada
   * línea al stock disponible (parcial o cancelada), se descuenta el stock y se
   * crea la orden. Si algo falla no queda nada a medias.
   */
  async createOrder(
    data: CreateOrderDto & { fromCart?: boolean },
    userId: string,
  ): Promise<any> {
    if (!userId) throw new ValidationError("Session id is required");
    if (data?.fromCart) return this.createOrderFromCart(data, userId);
    if (!Array.isArray(data?.orderItems) || data.orderItems.length === 0) {
      throw new ValidationError("Order must have at least one item");
    }
    for (const item of data.orderItems) {
      if (!Number.isInteger(Number(item.productVariantId)) || !Number.isInteger(Number(item.quantity)) || !(Number(item.quantity) > 0)) {
        throw new ValidationError("Cada ítem necesita productVariantId y quantity entera > 0");
      }
    }
    const paymentType = this.parsePaymentType(data.paymentType);
    const shipping = await this.resolveShipping((data as any).shippingMethod, userId);

    const order = await this.orderRepository.withTransaction((tx) => this.placeOrder(data, paymentType, userId, tx, shipping));
    this.logCreated(order, userId, false);
    this.mailReceived(order);
    return order;
  }

  private logCreated(order: any, userId: string, fromCart: boolean) {
    if (!order?.id) return;
    log.info(
      {
        orderId: order.id,
        userId,
        fromCart,
        paymentType: order.paymentType,
        total: Number(order.totalPrice),
        shippingCost: Number(order.shippingCost) || 0,
        shippingMethod: order.shipment?.method ?? "PICKUP",
        items: order.orderItems?.length,
        event: "order_created",
      },
      `Orden ${order.id} creada (${order.paymentType}, $${Number(order.totalPrice) + (Number(order.shippingCost) || 0)})`,
    );
  }

  /** Mail de "pedido recibido". Con Mercado Pago se manda al acreditarse el pago. */
  private mailReceived(order: any) {
    if (order?.id && order.paymentType !== "MERCADOPAGO") orderMails.notify("received", order.id);
  }

  /** PICKUP (por defecto) o DELIVERY: en ese caso exige domicilio y cotiza en el servidor. */
  private async resolveShipping(method: unknown, userId: string): Promise<ShippingChoice> {
    const value = String(method ?? "PICKUP").toUpperCase();
    if (value === "PICKUP") return { method: "PICKUP" };
    if (value !== "DELIVERY") throw new ValidationError("shippingMethod debe ser PICKUP o DELIVERY");
    const { quote, address } = await this.shippingQuotes.requireQuote(userId);
    return { method: "DELIVERY", quote, address };
  }

  /**
   * Checkout: crea la orden con las líneas del carrito del usuario (respetando
   * la presentación elegida) y vacía el carrito, todo en la misma transacción.
   */
  private async createOrderFromCart(data: CreateOrderDto, userId: string) {
    const paymentType = this.parsePaymentType(data.paymentType);
    const shipping = await this.resolveShipping((data as any).shippingMethod, userId);
    return this.orderRepository.withTransaction(async (tx) => {
      const { cartId, items } = await this.cartService.itemsForCheckout(userId, tx);
      const order = await this.placeOrder(
        { ...data, orderItems: items as any },
        paymentType,
        userId,
        tx,
        shipping,
      );
      await this.cartService.clearCart(cartId, tx);
      return order;
    }).then((order) => {
      this.logCreated(order, userId, true);
      this.mailReceived(order);
      return order;
    });
  }

  private parsePaymentType(value?: string) {
    const paymentType = value ? String(value).toUpperCase() : "DEBIT";
    if (!PAYMENT_TYPES.includes(paymentType)) {
      throw new ValidationError(`paymentType debe ser uno de ${PAYMENT_TYPES.join(", ")}`);
    }
    if (paymentType === "MERCADOPAGO" && !isMercadoPagoConfigured()) {
      throw new ValidationError("El pago con Mercado Pago no está disponible en este momento. Elegí otra forma de pago.");
    }
    return paymentType;
  }

  /** Núcleo de la creación: debe correr dentro de una transacción. */
  private async placeOrder(
    data: CreateOrderDto,
    paymentType: string,
    userId: string,
    tx: any,
    shipping: ShippingChoice = { method: "PICKUP" },
  ) {
    await this.stockRepository.lockVariants(
      data.orderItems.map((i) => i.productVariantId),
      tx,
    );

    const now = new Date();
    let estimatedReadyAt: Date | undefined;
    let totalPrice = 0;
    const orderItems: any[] = [];

    // Secuencial: cada línea ve el stock ya descontado por las anteriores
    for (const item of data.orderItems) {
      const variant: any = await this.variantRepository.findForSale(item.productVariantId, tx);
      if (!variant || !variant.active || !variant.product?.active || !variant.availableWeb) {
        throw new ValidationError(
          `La variante ${item.productVariantId} no existe o no está disponible`,
        );
      }

      const fulfillment = this.computeFulfillment(
        variant,
        Number(item.quantity),
        item.selectedBulkOption ? Number(item.selectedBulkOption) : undefined,
      );

      let awaitingStockAt: Date | undefined;
      const days = Number(variant.requestTime) || 0;
      if (days > 0) {
        awaitingStockAt = new Date(now);
        awaitingStockAt.setDate(awaitingStockAt.getDate() + days);
        if (!estimatedReadyAt || awaitingStockAt > estimatedReadyAt) {
          estimatedReadyAt = awaitingStockAt;
        }
      }

      const quote = this.pricingService.quote({
        productVariant: variant,
        quantity: fulfillment.finalQty,
        selectedBulkOption: fulfillment.finalSize,
      });

      if (fulfillment.status !== "CANCELLED" && fulfillment.units > 0) {
        await this.stockRepository.createStockMovement(variant.id, -fulfillment.units, "OUT", tx);
        totalPrice += quote.totalPriceSnapshot;
      }

      orderItems.push({
        productVariantId: variant.id,
        productNameSnapshot: variant.product?.name ?? "",
        variantNameSnapshot: variant.name,
        quantity: fulfillment.finalQty,
        selectedBulkOption: fulfillment.finalSize,
        unitPriceSnapshot: quote.unitPriceSnapshot,
        discountAppliedSnapshot: quote.discountAppliedSnapshot,
        offerTypeSnapshot: quote.offerTypeSnapshot,
        status: fulfillment.status,
        awaitingStockAt,
      });
    }

    if (orderItems.every((i) => i.status === "CANCELLED")) {
      throw new ConflictError("No hay stock disponible para ninguno de los productos de la orden");
    }

    const delivery = shipping.method === "DELIVERY" ? shipping : null;
    const order = await this.orderRepository.createOrder(
      {
        userSuperTokensId: userId,
        totalPrice: Math.round(totalPrice * 100) / 100,
        totalItems: orderItems.length,
        paymentType,
        status: "PENDING",
        estimatedReadyAt,
        orderItems,
        shippingMethod: shipping.method,
        shippingCost: delivery ? delivery.quote.price : 0,
        shippingProvider: delivery?.quote.provider ?? null,
        shippingZone: delivery?.quote.zone ?? null,
      } as any,
      tx,
    );
    if (!delivery) return order;

    // Envío a domicilio: el envío se crea ya con los datos del domicilio y el costo cobrado
    let trackingCode = newTrackingCode();
    while (await this.shipmentRepository.trackingCodeExists(trackingCode, tx)) trackingCode = newTrackingCode();
    const a = delivery.address;
    await this.shipmentRepository.createShipment(
      {
        orderId: order.id,
        trackingCode,
        method: "DELIVERY",
        status: "PENDING",
        recipientName: a.recipientName,
        phone: a.phone,
        address: streetLine(a),
        // Localidad/barrio si la cargó; si no, el departamento (no se repite con address)
        city: a.city ? `${a.city}, ${a.zone}` : a.zone,
        province: a.province,
        postalCode: a.postalCode,
        notes: a.notes,
        zone: a.zone,
        cost: delivery.quote.price,
        provider: delivery.quote.provider,
        carrier: delivery.quote.provider === "uber" ? "Uber Direct" : null,
      },
      { status: "PENDING", description: "Recibimos tu pedido" },
      tx,
    );
    return this.orderRepository.getOrder(order.id, tx);
  }

  /** Detalle de una orden. Un cliente solo puede ver las suyas. */
  async getOrder(id: number, actor?: Actor, tx?: any) {
    const order = await this.orderRepository.getOrder(id, tx);
    if (!order) throw new NotFoundError();
    if (actor && !actor.isStaff && order.userSuperTokensId !== actor.userId) {
      throw new NotFoundError(); // no revelamos que existe
    }
    return order;
  }

  async listMyOrders(userId: string, page = 1, perPage = 10) {
    return this.orderRepository.listByUser(userId, page, Math.min(50, perPage));
  }

  /**
   * Actualiza una orden.
   *   - Cliente: solo puede cancelar SU orden mientras esté PENDING/PROCESSING.
   *   - Staff:   cambia estado, devuelve ítems (parcial o total), marca espera de stock.
   * Cancelaciones y devoluciones reponen stock con movimientos RETURN.
   */
  async updateOrder(id: number, data: UpdateOrderDto, actor: Actor) {
    if (!id) throw new NotFoundError();
    if (!data) throw new ValidationError("body vacío");

    let cancelled = false;
    let change: Record<string, any> | null = null;
    const updated = await this.orderRepository.withTransaction(async (tx) => {
      const order = await this.getOrder(id, actor, tx);

      if (order.status === "CANCELLED") {
        throw new ConflictError("Order is already cancelled");
      }
      if (!actor.isStaff) {
        const onlyCancel =
          data.status === "CANCELLED" && !data.editItem?.length && Object.keys(data).length === 1;
        if (!onlyCancel) throw new ForbidenError("Solo podés cancelar tu orden");
        if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
          throw new ConflictError(
            "La orden ya está en preparación y no se puede cancelar. Contactá a la tienda.",
          );
        }
        if (["APPROVED", "IN_PROCESS"].includes(order.paymentStatus)) {
          throw new ConflictError(
            "El pedido ya tiene un pago aprobado o en revisión. Contactá a la tienda para cancelarlo.",
          );
        }
      }
      if (data.status && !ORDER_STATUSES.includes(data.status)) {
        throw new ValidationError(`status debe ser uno de ${ORDER_STATUSES.join(", ")}`);
      }
      if (data.status && data.status !== order.status) {
        const allowed = ORDER_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(data.status)) {
          throw new ConflictError(
            `No se puede pasar de ${order.status} a ${data.status}` +
              (allowed.length ? ` (permitido: ${allowed.join(", ")})` : " (estado final)"),
          );
        }
      }

      const fields: Record<string, any> = {};

      if (data.status === "CANCELLED") {
        for (const item of order.orderItems) {
          await this.closeItem(order, item, "CANCELLED", tx);
        }
      } else {
        for (const change of data.editItem ?? []) {
          await this.applyItemChange(order, change, fields, tx);
        }
        if (data.status) fields.status = data.status;
      }

      // Entrega estimada = la fecha más lejana de las líneas abiertas que siguen esperando
      // (si ninguna espera, se limpia). Se recalcula para poder adelantarla o quitarla.
      const pendingDates = order.orderItems
        .filter((it: any) => !CLOSED_ITEM_STATUSES.includes(it.status) && it.awaitingStockAt)
        .map((it: any) => new Date(it.awaitingStockAt).getTime());
      const eta = pendingDates.length ? new Date(Math.max(...pendingDates)) : null;
      if (String(eta?.getTime() ?? null) !== String(order.estimatedReadyAt ? new Date(order.estimatedReadyAt).getTime() : null)) {
        fields.estimatedReadyAt = eta;
      }

      // Totales y estado derivados de las líneas
      fields.totalPrice = order.orderItems.reduce(
        (sum: number, it: any) => sum + this.pricingService.lineTotal(it),
        0,
      );
      fields.totalPrice = Math.round(fields.totalPrice * 100) / 100;
      if (order.orderItems.every((it: any) => CLOSED_ITEM_STATUSES.includes(it.status))) {
        fields.status = "CANCELLED";
      }

      // Si la orden se cancela, su envío (si no terminó) también
      const shipment = order.shipment;
      if (
        fields.status === "CANCELLED" &&
        shipment &&
        !["DELIVERED", "RETURNED", "CANCELLED"].includes(shipment.status)
      ) {
        await this.shipmentRepository.updateShipment(
          shipment.id,
          { status: "CANCELLED" },
          { status: "CANCELLED", description: "Envío cancelado junto con el pedido" },
          tx,
        );
      }

      cancelled = fields.status === "CANCELLED";
      change = {
        ...(fields.status && fields.status !== order.status ? { status: { from: order.status, to: fields.status } } : {}),
        ...(Number(fields.totalPrice) !== Number(order.totalPrice) ? { totalPrice: { from: Number(order.totalPrice), to: fields.totalPrice } } : {}),
        ...(data.editItem?.length ? { editedItems: data.editItem.length } : {}),
      };
      return this.orderRepository.updateOrderFields(id, fields, tx);
    });
    // (se asigna dentro del callback: TS no lo ve)
    const changes = change as Record<string, any> | null;
    if (changes && Object.keys(changes).length) {
      log.info(
        { orderId: id, by: actor.userId, staff: actor.isStaff, ...changes, event: cancelled ? "order_cancelled" : "order_updated" },
        cancelled ? `Orden ${id} cancelada` : `Orden ${id} actualizada`,
      );
    }
    if (cancelled) orderMails.notify("cancelled", id);
    return updated;
  }

  /** Devuelve TODO el stock de una línea y la cierra. */
  private async closeItem(order: any, item: any, status: "CANCELLED" | "RETURNED", tx: any) {
    if (CLOSED_ITEM_STATUSES.includes(item.status)) return;
    const units = stockUnitsOf(item);
    if (units > 0 && item.productVariantId) {
      await this.stockRepository.createStockMovement(item.productVariantId, units, "RETURN", tx);
    }
    const updated = { status, quantity: 0, discountAppliedSnapshot: 0 };
    await this.orderRepository.updateItem(item.id, updated, tx);
    Object.assign(item, updated);
  }

  private async applyItemChange(
    order: any,
    change: UpdateOrderItemDto,
    orderFields: Record<string, any>,
    tx: any,
  ) {
    const item = order.orderItems.find((i: any) =>
      change.id ? i.id === Number(change.id) : i.productVariantId === Number(change.productVariantId),
    );
    if (!item) {
      throw new ValidationError(
        `Item ${change.id ?? change.productVariantId} not found in order`,
      );
    }
    if (CLOSED_ITEM_STATUSES.includes(item.status)) {
      throw new ConflictError(`El ítem ${item.id} ya está ${item.status}`);
    }

    // Cierre total de la línea
    if (change.status === "CANCELLED" || change.status === "RETURNED") {
      await this.closeItem(order, item, change.status, tx);
      return;
    }

    const itemData: Record<string, any> = {};

    // Devolución parcial: solo se puede bajar la cantidad
    if (change.quantity != null) {
      const newQty = Number(change.quantity);
      if (!Number.isFinite(newQty) || newQty < 0 || newQty >= item.quantity) {
        throw new ValidationError("La nueva cantidad debe ser menor a la actual y >= 0");
      }
      if (newQty === 0) {
        await this.closeItem(order, item, "RETURNED", tx);
        return;
      }
      const returnedUnits = stockUnitsOf(item) - stockUnitsOf({ ...item, quantity: newQty });
      await this.stockRepository.createStockMovement(
        item.productVariantId,
        returnedUnits,
        "RETURN",
        tx,
      );
      // El descuento se prorratea a la cantidad que queda
      itemData.discountAppliedSnapshot =
        Math.round(((item.discountAppliedSnapshot ?? 0) * newQty * 100) / item.quantity) / 100;
      itemData.quantity = newQty;
      itemData.status = "PARTIALLY_RETURNED";
    }

    if (change.awaitingStockAt) {
      const date = new Date(change.awaitingStockAt);
      if (Number.isNaN(date.getTime())) throw new ValidationError("awaitingStockAt inválido");
      if (date.getTime() < Date.now() - 60_000) {
        throw new ValidationError("La fecha estimada de reposición tiene que ser posterior a ahora");
      }
      itemData.awaitingStockAt = date;
      itemData.status = "AWAITING_STOCK";
    } else if (change.status === "FULFILLED") {
      // Llegó el stock: la línea deja de esperar
      itemData.status = "FULFILLED";
      itemData.awaitingStockAt = null;
    } else if (change.status === "AWAITING_STOCK") {
      itemData.status = change.status;
    }

    if (Object.keys(itemData).length > 0) {
      await this.orderRepository.updateItem(item.id, itemData, tx);
      Object.assign(item, itemData);
    }
  }

  /**
   * Ajusta lo pedido al stock disponible.
   *   - Sin presentaciones: `requested` son gramos (KG) o unidades.
   *   - Con presentaciones: `requested` son paquetes de `selectedBulkOption` g/u.
   *     Si no alcanza, prueba menos paquetes y luego presentaciones más chicas.
   */
  private computeFulfillment(
    variant: any,
    requested: number,
    selectedBulkOption?: number,
  ): Fulfillment {
    const stock = Number(variant.currentStock || 0);
    const packaging: number[] = (variant.packagingOptions || [])
      .map(Number)
      .filter((n: number) => n > 0)
      .sort((a: number, b: number) => a - b);

    if (stock <= 0) return { finalSize: null, finalQty: 0, status: "CANCELLED", units: 0 };

    if (packaging.length === 0) {
      const qty = Math.min(stock, requested);
      return {
        finalSize: null,
        finalQty: qty,
        status: qty === requested ? "FULFILLED" : "PARTIALLY_RETURNED",
        units: qty,
      };
    }

    const size =
      selectedBulkOption && packaging.includes(selectedBulkOption)
        ? selectedBulkOption
        : packaging[0];
    if (selectedBulkOption && !packaging.includes(selectedBulkOption)) {
      throw new ValidationError(
        `La presentación ${selectedBulkOption} no existe para "${variant.name}" (opciones: ${packaging.join(", ")})`,
      );
    }

    if (stock >= size * requested) {
      return { finalSize: size, finalQty: requested, status: "FULFILLED", units: size * requested };
    }
    const maxSame = Math.floor(stock / size);
    if (maxSame >= 1) {
      return { finalSize: size, finalQty: maxSame, status: "PARTIALLY_RETURNED", units: maxSame * size };
    }
    const fallback = packaging.find((s) => s <= stock);
    if (!fallback) return { finalSize: null, finalQty: 0, status: "CANCELLED", units: 0 };
    const qty = Math.floor(stock / fallback);
    return { finalSize: fallback, finalQty: qty, status: "PARTIALLY_RETURNED", units: qty * fallback };
  }
}
