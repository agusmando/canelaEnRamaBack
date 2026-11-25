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
import { DiscountCodeService } from "./discount-code.service.js";
import { ShipmentRepository } from "../repository/shipment.repository.js";
import { isMercadoPagoConfigured } from "../config/mercadopago.js";
import { streetLine, ShippingQuoteService, type ShippingQuote } from "./shipping-quote.service.js";
import { orderMails, type OrderMailKind } from "./order-mail.service.js";
import { orderChargeTotal } from "../utils/pricing.js";
import { newTrackingCode } from "../utils/trackingCode.js";
import { getLogger } from "../config/logger.js";

const log = getLogger("order");

/** Envío resuelto antes de abrir la transacción (la cotización es una llamada externa). */
type ShippingChoice =
  | { method: "PICKUP" }
  | { method: "DELIVERY"; quote: ShippingQuote; address: any };

export const PAYMENT_TYPES = ["DEBIT", "CREDIT", "CASH", "TRANSFER", "MERCADOPAGO"];
/** Medios aceptados en órdenes nuevas: las tarjetas se cobran por Mercado Pago (DEBIT/CREDIT quedan solo en pedidos viejos). */
export const NEW_ORDER_PAYMENT_TYPES = ["CASH", "TRANSFER", "MERCADOPAGO"];
export function parsePaymentType(value?: string, opts: { counter?: boolean } = {}) {
  const paymentType = value ? String(value).toUpperCase() : "CASH";
  if (paymentType === "DEBIT" || paymentType === "CREDIT") {
    throw new ValidationError(
      `paymentType debe ser uno de ${NEW_ORDER_PAYMENT_TYPES.join(", ")}. Las tarjetas se pagan con Mercado Pago.`,
    );
  }
  if (!NEW_ORDER_PAYMENT_TYPES.includes(paymentType)) {
    throw new ValidationError(`paymentType debe ser uno de ${NEW_ORDER_PAYMENT_TYPES.join(", ")}`);
  }
  if (paymentType === "MERCADOPAGO" && !opts.counter && !isMercadoPagoConfigured()) {
    throw new ValidationError("El pago con Mercado Pago no está disponible en este momento. Elegí otra forma de pago.");
  }
  return paymentType;
}
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

/** Espejo de SHIPMENT_TRANSITIONS.PICKUP (shipment.service), sin import circular. */
const PICKUP_SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PREPARING", "READY_FOR_PICKUP", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
};

/** El cliente solo puede cancelar mientras nadie empezó a preparar la orden. */
const CUSTOMER_CANCELLABLE = ["PENDING"];
const CLOSED_ITEM_STATUSES = ["CANCELLED", "RETURNED", "OUT_OF_STOCK"];

type Fulfillment = {
  finalSize: number | null;
  finalQty: number;
  status: "FULFILLED" | "PARTIALLY_RETURNED" | "OUT_OF_STOCK";
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
    private readonly discountCodeService = new DiscountCodeService(),
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
    this.assertWebPayment(paymentType, shipping.method);

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
      `Orden ${order.id} creada (${order.paymentType}, $${orderChargeTotal(order)})`,
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
    this.assertWebPayment(paymentType, shipping.method);
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

  /**
   * Venta de mostrador (POST /order/counter, solo staff): en un paso queda
   * entregada y cobrada, descuenta stock y suma a las estadísticas. Sin envío
   * ni mails. Si falta stock de alguna línea no se registra nada.
   */
  async createCounterSale(data: CreateOrderDto, userId: string): Promise<any> {
    if (!userId) throw new ValidationError("Session id is required");
    if (!Array.isArray(data?.orderItems) || data.orderItems.length === 0) {
      throw new ValidationError("Agregá al menos un producto");
    }
    for (const item of data.orderItems) {
      if (!Number.isInteger(Number(item.productVariantId)) || !Number.isInteger(Number(item.quantity)) || !(Number(item.quantity) > 0)) {
        throw new ValidationError("Cada ítem necesita productVariantId y quantity entera > 0");
      }
    }
    const paymentType = this.parsePaymentType(data.paymentType, { counter: true });
    const order = await this.orderRepository.withTransaction((tx) =>
      this.placeOrder(data, paymentType, userId, tx, { method: "PICKUP" }, { counter: true }),
    );
    log.info(
      {
        orderId: order.id,
        userId,
        paymentType,
        total: Number(order.totalPrice),
        items: order.orderItems?.length,
        event: "counter_sale",
      },
      `Venta de mostrador ${order.id} registrada (${paymentType}, $${Number(order.totalPrice)})`,
    );
    return order;
  }

  /**
   * Tienda online: Mercado Pago siempre; "Efectivo / Transferencia" (CASH) solo
   * para retiro en el local, se paga al retirar. TRANSFER queda para el mostrador.
   */
  private assertWebPayment(paymentType: string, method: string) {
    if (paymentType === "TRANSFER") {
      throw new ValidationError("Elegí Efectivo / Transferencia: se paga al retirar en el local.");
    }
    if (paymentType === "CASH" && method !== "PICKUP") {
      throw new ValidationError("Los envíos a domicilio se pagan con Mercado Pago. Efectivo / Transferencia es solo para retiro en el local.");
    }
  }

  private parsePaymentType(value?: string, opts: { counter?: boolean } = {}) {
    return parsePaymentType(value, opts);
  }

  /** Núcleo de la creación: debe correr dentro de una transacción. */
  private async placeOrder(
    data: CreateOrderDto,
    paymentType: string,
    userId: string,
    tx: any,
    shipping: ShippingChoice = { method: "PICKUP" },
    opts: { counter?: boolean } = {},
  ) {
    await this.stockRepository.lockVariants(
      data.orderItems.map((i) => i.productVariantId),
      tx,
    );

    const now = new Date();
    let estimatedReadyAt: Date | undefined;
    let totalPrice = 0;
    const orderItems: any[] = [];
    // Unidades descontadas por variante: al crear la orden se les anota el pedido.
    const soldCounts = new Map<number, number>();

    // Secuencial: cada línea ve el stock ya descontado por las anteriores
    for (const item of data.orderItems) {
      const variant: any = await this.variantRepository.findForSale(item.productVariantId, tx);
      // En mostrador se vende todo lo activo, aunque no se publique en la tienda
      if (!variant || !variant.active || !variant.product?.active || (!opts.counter && !variant.availableWeb)) {
        throw new ValidationError(
          `La variante ${item.productVariantId} no existe o no está disponible`,
        );
      }

      const fulfillment = this.computeFulfillment(
        variant,
        Number(item.quantity),
        item.selectedBulkOption ? Number(item.selectedBulkOption) : undefined,
      );
      // Mostrador: la mercadería ya se entregó, no se ajusta ni se deja en espera
      if (opts.counter && (fulfillment.status !== "FULFILLED" || fulfillment.finalQty !== Number(item.quantity))) {
        throw new ConflictError(
          `No alcanza el stock de ${variant.product?.name ?? ""} ${variant.name}`.trim() +
            ". Corregí el stock con un ajuste y volvé a registrar la venta.",
        );
      }

      let awaitingStockAt: Date | undefined;
      const days = opts.counter ? 0 : Number(variant.requestTime) || 0;
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

      if (fulfillment.units > 0) {
        await this.stockRepository.createStockMovement(variant.id, -fulfillment.units, "OUT", tx);
        soldCounts.set(variant.id, (soldCounts.get(variant.id) ?? 0) + 1);
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
        offerParams: quote.offerSnapshot ?? null,
        status: fulfillment.status,
        awaitingStockAt,
      });
    }

    if (orderItems.every((i) => CLOSED_ITEM_STATUSES.includes(i.status))) {
      throw new ConflictError("No hay stock disponible para ninguno de los productos de la orden");
    }

    // Cupón de descuento sobre el subtotal de productos (después de ofertas).
    // Si el código no sirve, placeOrder falla y no queda orden a medias.
    const subtotal = Math.round(totalPrice * 100) / 100;
    const coupon = await this.discountCodeService.resolveForOrder(
      (data as any).discountCode,
      subtotal,
      userId,
      tx,
    );

    const delivery = shipping.method === "DELIVERY" ? shipping : null;
    const order = await this.orderRepository.createOrder(
      {
        userSuperTokensId: userId,
        totalPrice: Math.round(totalPrice * 100) / 100,
        totalItems: orderItems.length,
        paymentType,
        status: opts.counter ? "DELIVERED" : "PENDING",
        // Mostrador: se cobra en el momento (también Mercado Pago, con QR o link fuera de la tienda)
        ...(opts.counter ? { channel: "COUNTER", paymentStatus: "APPROVED", paidAt: now } : {}),
        estimatedReadyAt,
        orderItems,
        shippingMethod: shipping.method,
        shippingCost: delivery ? delivery.quote.price : 0,
        shippingProvider: delivery?.quote.provider ?? null,
        shippingZone: delivery?.quote.zone ?? null,
        ...(coupon
          ? {
              couponCode: coupon.code,
              couponDiscount: coupon.discount,
              discountCodeId: coupon.id,
              couponParams: coupon.params,
            }
          : {}),
      } as any,
      tx,
    );

    // Las ventas se registran como OUT genérico: les dejamos la orden de origen.
    // La variante está lockeada y sus movimientos más recientes son los de esta tx.
    const saleNote = opts.counter
      ? `Venta de mostrador · pedido #${order.id}`
      : `Venta online · pedido #${order.id}`;
    for (const [variantId, count] of soldCounts) {
      const movements =
        (await tx.stockMovement?.findMany({
          where: { productVariantId: variantId, type: "OUT", note: null },
          orderBy: { id: "desc" },
          take: count,
          select: { id: true },
        })) ?? [];
      if (movements.length) {
        await tx.stockMovement.updateMany({
          where: { id: { in: movements.map((m: any) => m.id) } },
          data: { note: saleNote },
        });
      }
    }

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
    if (actor && !actor.permissions.includes("orders.manage") && order.userSuperTokensId !== actor.userId) {
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
    // Ítems tocados por editItem: el mail "updated" lista solo esos
    const editedItemIds: number[] = [];
    // Aviso al cliente, se decide dentro de la transacción y sale después del commit
    let mail: OrderMailKind | null = null;
    const updated = await this.orderRepository.withTransaction(async (tx) => {
      const order = await this.getOrder(id, actor, tx);

      if (order.status === "CANCELLED") {
        throw new ConflictError("Order is already cancelled");
      }
      if (!actor.permissions.includes("orders.manage")) {
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
      if (
        data.status === "CANCELLED" &&
        order.paymentType === "MERCADOPAGO" &&
        order.paymentStatus === "APPROVED"
      ) {
        throw new ConflictError("Usá la acción “Cancelar y reintegrar total” para cancelar una orden pagada");
      }

      const fields: Record<string, any> = {};

      if (data.status === "CANCELLED") {
        for (const item of order.orderItems) {
          await this.closeItem(order, item, "CANCELLED", tx);
        }
      } else {
        for (const change of data.editItem ?? []) {
          await this.applyItemChange(order, change, fields, tx, editedItemIds);
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

      // El cupón se reevalúa sobre el nuevo subtotal: un % baja, un monto fijo
      // se topa al subtotal y si ya no se llega a la compra mínima no aplica.
      if (order.couponCode && Number(fields.totalPrice) !== Number(order.totalPrice)) {
        fields.couponDiscount = this.repriceCouponDiscount(order, fields.totalPrice);
      }
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

      // Retiro en el local: "despachar" la orden = listo para retirar; "entregada" = retirado.
      // El envío acompaña (así el seguimiento coincide) y el cliente recibe el aviso de retiro.
      if (
        shipment?.method === "PICKUP" &&
        fields.status &&
        fields.status !== order.status &&
        (fields.status === "SHIPPED" || fields.status === "DELIVERED")
      ) {
        const target = fields.status === "SHIPPED" ? "READY_FOR_PICKUP" : "DELIVERED";
        const allowed = PICKUP_SHIPMENT_TRANSITIONS[shipment.status] ?? [];
        if (shipment.status !== target && allowed.includes(target)) {
          const now = new Date();
          await this.shipmentRepository.updateShipment(
            shipment.id,
            {
              status: target,
              ...(target === "READY_FOR_PICKUP" && !shipment.shippedAt ? { shippedAt: now } : {}),
              ...(target === "DELIVERED" ? { deliveredAt: now } : {}),
            },
            { status: target, description: target === "READY_FOR_PICKUP" ? "Tu pedido está listo para retirar" : "Pedido retirado" },
            tx,
          );
        }
      }
      cancelled = fields.status === "CANCELLED";
      mail = this.mailFor(order, fields.status, data.editItem ?? [], actor);
      change = {
        ...(fields.status && fields.status !== order.status ? { status: { from: order.status, to: fields.status } } : {}),
        ...(Number(fields.totalPrice) !== Number(order.totalPrice) ? { totalPrice: { from: Number(order.totalPrice), to: fields.totalPrice } } : {}),
        ...(data.editItem?.length ? { editedItems: data.editItem.length } : {}),
        ...(Number(fields.couponDiscount) !== Number(order.couponDiscount)
          ? { couponDiscount: { from: Number(order.couponDiscount) || 0, to: Number(fields.couponDiscount) || 0 } }
          : {}),
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
    // (se asigna dentro del callback: TS lo estrecha a null)
    const pendingMail = mail as OrderMailKind | null;
    if (pendingMail) orderMails.notify(pendingMail, id, { itemIds: editedItemIds });
    return updated;
  }

  /**
   * Qué mail corresponde a un cambio hecho con updateOrder (uno solo, el más
   * importante). Los cambios del envío (listo, en camino, entregado) se avisan
   * desde ShipmentService, que actualiza la orden por otro camino.
   */
  private mailFor(order: any, newStatus: string | undefined, changes: UpdateOrderItemDto[], actor: Actor): OrderMailKind | null {
    // Las ventas de mostrador no mandan mails (el cliente está en el local)
    if (order.channel === "COUNTER") return null;
    const changed = newStatus && newStatus !== order.status ? newStatus : null;
    if (changed === "CANCELLED") return "cancelled";
    if (changed === "SHIPPED") return order.shippingMethod === "DELIVERY" ? "onTheWay" : "ready";
    if (changed === "DELIVERED") return "delivered";
    // La tienda tocó productos que le cambian algo al cliente: sacó líneas,
    // las devolvió (total o parcial) o las puso a la espera de reposición
    const affectsCustomer = changes.some(
      (c) =>
        c.status === "CANCELLED" ||
        c.status === "RETURNED" ||
        c.status === "AWAITING_STOCK" ||
        c.quantity != null ||
        !!c.awaitingStockAt,
    );
    return actor.isStaff && affectsCustomer ? "updated" : null;
  }

  /** Devuelve TODO el stock de una línea y la cierra. */
  private async closeItem(order: any, item: any, status: "CANCELLED" | "RETURNED", tx: any) {
    if (CLOSED_ITEM_STATUSES.includes(item.status)) return;
    const units = stockUnitsOf(item);
    if (units > 0 && item.productVariantId) {
      const note =
        status === "CANCELLED"
          ? `Cancelación · pedido #${order.id}`
          : `Devolución · pedido #${order.id}`;
      await this.stockRepository.createStockMovement(item.productVariantId, units, "RETURN", tx, null, note);
    }
    const updated = { status, quantity: 0, discountAppliedSnapshot: 0 };
    await this.orderRepository.updateItem(item.id, updated, tx);
    Object.assign(item, updated);
  }

  /**
   * Recotiza el descuento del cupón sobre un nuevo subtotal de productos,
   * con los parámetros guardados al momento de la compra (`couponParams`).
   * Sin snapshot (órdenes viejas) conserva el descuento original.
   */
  private repriceCouponDiscount(order: any, subtotal: number): number {
    const p = order.couponParams as any;
    if (!p?.discountType) return Number(order.couponDiscount) || 0;
    const base = Math.max(0, Number(subtotal) || 0);
    const min = Number(p.minOrderAmount) || 0;
    if (min > 0 && base < min) return 0;
    let discount =
      p.discountType === "PERCENTAGE" ? (base * Number(p.discountValue)) / 100 : Number(p.discountValue);
    if (p.maxDiscountAmount != null) discount = Math.min(discount, Number(p.maxDiscountAmount));
    return Math.round(Math.min(Math.max(0, discount), base) * 100) / 100;
  }

  private async applyItemChange(
    order: any,
    change: UpdateOrderItemDto,
    orderFields: Record<string, any>,
    tx: any,
    editedItemIds: number[],
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
    editedItemIds.push(item.id);

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
        null,
        `Devolución parcial · pedido #${order.id}`,
      );
      // El descuento se recotiza para la nueva cantidad con los parámetros de la
      // oferta original (3x2, "desde N", etc. no son lineales). Sin snapshot
      // (órdenes viejas) prorratea.
      itemData.discountAppliedSnapshot = this.pricingService.lineDiscountForQuantity(item, newQty);
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

    if (stock <= 0) return { finalSize: null, finalQty: 0, status: "OUT_OF_STOCK", units: 0 };

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
    if (!fallback) return { finalSize: null, finalQty: 0, status: "OUT_OF_STOCK", units: 0 };
    const qty = Math.floor(stock / fallback);
    return { finalSize: fallback, finalQty: qty, status: "PARTIALLY_RETURNED", units: qty * fallback };
  }
}
