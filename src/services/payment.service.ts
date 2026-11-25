import crypto from "node:crypto";
import { isMercadoPagoConfigured, mpConfig, mpRequest } from "../config/mercadopago.js";
import { OrderRepository } from "../repository/order.repository.js";
import { OrderService } from "./order.service.js";
import { PricingService } from "./pricing.service.js";
import type { Actor } from "../middleware/auth.middleware.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { orderMails } from "./order-mail.service.js";
import { ExternalServiceError } from "../errors/infra/ExternalServiceError.js";
import { permissionsForRoles } from "../config/rbac.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { emailBrandingConfig, isBrandedEmailConfigured, renderBrandedEmail } from "./email.service.js";
import { orderChargeTotal } from "../utils/pricing.js";
import { errInfo, getLogger } from "../config/logger.js";

const log = getLogger("payment");

/** Estados de pago de Mercado Pago → PaymentStatus de la orden. */
const STATUS_MAP: Record<string, string> = {
  pending: "PENDING",
  authorized: "IN_PROCESS",
  in_process: "IN_PROCESS",
  in_mediation: "IN_PROCESS",
  approved: "APPROVED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
  charged_back: "CHARGED_BACK",
};

/** Mientras el pago esté en alguno de estos estados no se puede volver a pagar ni cancelar como cliente. */
export const PAYMENT_LOCKED = ["APPROVED", "IN_PROCESS"];

const SYSTEM_ACTOR: Actor = {
  userId: "system:mercadopago",
  roles: ["ADMIN"],
  permissions: permissionsForRoles(["ADMIN"]),
  isStaff: true,
};
const round2 = (n: number) => Math.round(n * 100) / 100;
/**
 * Cobro de pedidos con Mercado Pago (Checkout Pro).
 *
 * Flujo:
 *  1. El cliente confirma el carrito con paymentType MERCADOPAGO → se crea la orden
 *     (PENDING, stock reservado).
 *  2. POST /payment/order/:id/preference → se crea la preferencia y se devuelve
 *     `initPoint`; la web redirige ahí.
 *  3. Mercado Pago avisa por webhook (POST /payment/webhook) y además, al volver a
 *     la tienda, la web llama a POST /payment/order/:id/sync. En ambos casos el pago
 *     se RE-CONSULTA a la API de Mercado Pago (nunca se confía en lo que llega).
 *  4. Pago aprobado → paymentStatus APPROVED y la orden pasa a PROCESSING.
 *  5. Si nadie paga en MP_ORDER_TTL_HOURS, la orden se cancela y el stock vuelve.
 */
/** Lo que paga el cliente: productos (con ofertas) − cupón + envío. */
const chargeTotal = orderChargeTotal;

export class PaymentService {
  constructor(
    private readonly orderRepository = new OrderRepository(),
    private readonly orderService = new OrderService(),
    private readonly pricingService = new PricingService(),
  ) {}

  publicConfig() {
    return { mercadoPago: { enabled: isMercadoPagoConfigured() } };
  }

  private ensureConfigured() {
    if (!isMercadoPagoConfigured()) {
      throw new BadRequestError("El pago con Mercado Pago no está disponible en este momento");
    }
  }

  /** Crea una preferencia de Checkout Pro para una orden del usuario. */
  async createPreference(orderId: number, actor: Actor) {
    this.ensureConfigured();
    const order = await this.orderService.getOrder(orderId, actor);

    if (order.paymentType !== "MERCADOPAGO") {
      throw new ConflictError("Este pedido no se paga con Mercado Pago");
    }
    if (order.status !== "PENDING") {
      throw new ConflictError(
        order.status === "CANCELLED" ? "El pedido está cancelado" : "El pedido ya no está pendiente de pago",
      );
    }
    if (PAYMENT_LOCKED.includes(order.paymentStatus)) {
      throw new ConflictError(
        order.paymentStatus === "APPROVED" ? "El pedido ya está pagado" : "Tenés un pago en revisión para este pedido",
      );
    }
    const total = chargeTotal(order);
    if (!(total > 0)) throw new ConflictError("El pedido no tiene importe a cobrar");

    const cfg = mpConfig();
    const expiresAt = new Date(new Date(order.createdAt).getTime() + cfg.orderTtlHours * 3600_000);
    if (expiresAt.getTime() <= Date.now()) {
      throw new ConflictError("Venció el plazo para pagar este pedido");
    }

    const orderUrl = cfg.webUrl ? `${cfg.webUrl}/mi-cuenta/pedidos/${order.id}` : "";
    const https = (url: string) => url.startsWith("https://");

    const body: Record<string, any> = {
      items: this.buildItems(order, total),
      external_reference: String(order.id),
      metadata: { order_id: order.id },
      statement_descriptor: cfg.statementDescriptor,
      expires: true,
      expiration_date_to: expiresAt.toISOString(),
      payment_methods: cfg.allowCash
        ? undefined
        : { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
    };
    if (order.user?.email) {
      body.payer = { email: order.user.email, ...(order.user.name ? { name: order.user.name } : {}) };
    }
    if (orderUrl) {
      body.back_urls = {
        success: `${orderUrl}?pago=aprobado`,
        pending: `${orderUrl}?pago=pendiente`,
        failure: `${orderUrl}?pago=rechazado`,
      };
      // Mercado Pago solo acepta auto_return con back_urls https
      if (https(orderUrl)) body.auto_return = "approved";
    }
    if (https(cfg.apiPublicUrl)) {
      body.notification_url = `${cfg.apiPublicUrl}/api/payment/webhook?source_news=webhooks`;
    }

    let pref: any;
    try {
      pref = await mpRequest("/checkout/preferences", {
        method: "POST",
        body,
        idempotencyKey: `order-${order.id}-total-${total.toFixed(2)}-${expiresAt.getTime()}`,
      });
    } catch (err: any) {
      log.error({ orderId: order.id, total, ...errInfo(err) }, `No se pudo crear la preferencia de pago de la orden ${order.id}`);
      throw new ExternalServiceError("Mercado Pago", err.message);
    }

    await this.orderRepository.updateOrderFields(order.id, { paymentPreferenceId: pref.id });
    log.info(
      {
        orderId: order.id,
        preferenceId: pref.id,
        total,
        items: body.items.length,
        expiresAt: body.expiration_date_to,
        notificationUrl: !!body.notification_url,
        autoReturn: !!body.auto_return,
      },
      `Link de pago creado para la orden ${order.id} ($${total})`,
    );
    return {
      preferenceId: pref.id as string,
      initPoint: pref.init_point as string,
    };
  }

  /**
   * Una línea por producto (cantidad 1, importe = total de la línea con descuentos).
   * Si por redondeos la suma no coincide con el total de la orden, se cobra como un solo ítem.
   */
  private buildItems(order: any, total: number) {
    const lines = (order.orderItems ?? [])
      .map((it: any) => ({ it, amount: this.pricingService.lineTotal(it) }))
      .filter((l: any) => l.amount > 0);
    const shipping = round2(Number(order.shippingCost) || 0);

    const sum = round2(lines.reduce((s: number, l: any) => s + l.amount, 0) + shipping);
    if (lines.length && sum === total) {
      const items = lines.map(({ it, amount }: any) => ({
        id: String(it.productVariantId ?? it.id),
        title: `${it.productNameSnapshot}${it.variantNameSnapshot ? ` - ${it.variantNameSnapshot}` : ""}`.slice(0, 250),
        description: it.selectedBulkOption ? `${it.quantity} x ${it.selectedBulkOption}` : `Cantidad: ${it.quantity}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: round2(amount),
      }));
      if (shipping > 0) {
        items.push({
          id: `shipping-${order.id}`,
          title: "Envío a domicilio",
          description: order.shippingZone ? `Envío a ${order.shippingZone}` : "Envío",
          quantity: 1,
          currency_id: "ARS",
          unit_price: shipping,
        });
      }
      return items;
    }
    return [{ id: `order-${order.id}`, title: `Pedido #${order.id} - Canela en Rama`, quantity: 1, currency_id: "ARS", unit_price: total }];
  }

  /** Webhook: notificaciones de pago. Devuelve false si no era un pago (se ignora). */
  async handleNotification(type: string | undefined, paymentId: string | undefined) {
    if (!isMercadoPagoConfigured()) return false;
    if (type !== "payment" || !paymentId) return false;
    const payment = await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
    await this.applyPayment(payment);
    return true;
  }

  /**
   * Al volver de Mercado Pago (o desde el dashboard): busca los pagos de la orden
   * y aplica el más relevante. Así el estado se actualiza aunque el webhook demore.
   */
  async syncOrder(orderId: number, actor: Actor) {
    this.ensureConfigured();
    const order = await this.orderService.getOrder(orderId, actor);
    if (order.paymentType !== "MERCADOPAGO") return order;

    let results: any[] = [];
    try {
      const data = await mpRequest(
        `/v1/payments/search?external_reference=${encodeURIComponent(String(order.id))}&sort=date_created&criteria=desc&limit=20`,
      );
      results = data?.results ?? [];
    } catch (err: any) {
      log.warn({ orderId: order.id, ...errInfo(err) }, `No se pudieron consultar los pagos de la orden ${order.id}`);
      throw new ExternalServiceError("Mercado Pago", err.message);
    }
    log.debug(
      { orderId: order.id, found: results.length, statuses: results.map((p) => `${p.id}:${p.status}`) },
      `Sync de la orden ${order.id}: ${results.length} pago(s) en Mercado Pago`,
    );
    const best =
      results.find((p) => p.status === "approved") ??
      results.find((p) => ["in_process", "authorized", "in_mediation"].includes(p.status)) ??
      results[0];
    if (best) await this.applyPayment(best);
    return this.orderService.getOrder(orderId, actor);
  }

  /** Reintegra el pago completo, cancela la orden y avisa al cliente por email. */
  async refundFullOrder(orderId: number, noteValue: unknown, actor: Actor) {
    this.ensureConfigured();
    const note = typeof noteValue === "string" ? noteValue.trim() : "";
    if (!note || note.length > 2000) {
      throw new ValidationError("Indicá qué productos faltan (máximo 2000 caracteres)");
    }

    const visibleOrder: any = await this.orderService.getOrder(orderId, actor);
    if (visibleOrder.paymentType !== "MERCADOPAGO") {
      throw new ConflictError("El reintegro automático solo está disponible para pagos con Mercado Pago");
    }
    if (!visibleOrder.paymentId || !visibleOrder.user?.email) {
      throw new ConflictError("La orden no tiene un pago y un email de cliente válidos para reintegrar");
    }
    if (visibleOrder.status === "DELIVERED") {
      throw new ConflictError("No se puede cancelar una orden ya entregada");
    }
    if (!visibleOrder.refundEmailSentAt) {
      if (!isBrandedEmailConfigured()) {
        throw new BadRequestError("Configurá RESEND_API_KEY y RESEND_FROM_EMAIL para enviar el aviso al cliente");
      }
    }

    const order: any = await this.orderRepository.withTransaction(async (tx: any) => {
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const current = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });
      if (!current) throw new NotFoundError("Order not found");
      if (current.paymentType !== "MERCADOPAGO" || !current.paymentId || !current.user?.email) {
        throw new ConflictError("La orden no tiene un pago y un email de cliente válidos para reintegrar");
      }
      if (current.status === "DELIVERED") {
        throw new ConflictError("No se puede cancelar una orden ya entregada");
      }
      if (current.refundNote && current.refundNote !== note) {
        throw new ConflictError("El reintegro ya se inició con otra nota");
      }
      const refundAlreadyApproved = current.refundStatus === "APPROVED";
      if (!refundAlreadyApproved && current.paymentStatus !== "APPROVED") {
        throw new ConflictError("Solo se pueden reintegrar pagos aprobados de Mercado Pago");
      }
      if (!refundAlreadyApproved && !current.refundStatus) {
        await tx.order.update({
          where: { id: orderId },
          data: { refundStatus: "IN_PROGRESS", refundNote: note },
        });
      }
      return current;
    });

    let refund: any = {
      id: order.refundId,
      status: order.refundStatus?.toLowerCase(),
      amount: order.refundAmount,
    };
    if (order.refundStatus !== "APPROVED") {
      try {
        refund = order.refundId
          ? await mpRequest(
              `/v1/payments/${encodeURIComponent(order.paymentId)}/refunds/${encodeURIComponent(order.refundId)}`,
            )
          : await mpRequest(`/v1/payments/${encodeURIComponent(order.paymentId)}/refunds`, {
              method: "POST",
              body: {},
              idempotencyKey: `order-${orderId}-refund-full-${order.paymentId}`,
            });
      } catch (error: any) {
        await this.orderRepository.updateOrderFields(orderId, { refundStatus: "FAILED" });
        throw new ExternalServiceError("Mercado Pago", error.message);
      }
    }

    const refundStatus = String(refund?.status ?? "").toUpperCase();
    if (!refund?.id || !["APPROVED", "PENDING"].includes(refundStatus)) {
      await this.orderRepository.updateOrderFields(orderId, {
        refundId: refund?.id ? String(refund.id) : null,
        refundStatus: "FAILED",
        refundAmount: Number.isFinite(Number(refund?.amount)) ? Number(refund.amount) : null,
      });
      throw new ConflictError("Mercado Pago no pudo aprobar el reintegro total");
    }

    const latestOrder: any = await this.orderService.getOrder(orderId, actor);
    if (latestOrder.status !== "CANCELLED") {
      await this.orderService.updateOrder(orderId, { status: "CANCELLED" } as any, actor);
    }
    await this.orderRepository.updateOrderFields(orderId, {
      refundId: String(refund.id),
      refundStatus,
      refundAmount: Number(refund.amount ?? orderChargeTotal(order)),
      refundedAt: refundStatus === "APPROVED" ? new Date() : null,
      ...(refundStatus === "APPROVED" ? { paymentStatus: "REFUNDED" } : {}),
    });

    let emailSent = Boolean(order.refundEmailSentAt);
    let emailError: string | null = null;
    if (!emailSent) {
      try {
        const { resendApiKey, resendFromEmail } = mpConfig();
        const { siteUrl, logoUrl } = emailBrandingConfig();
        const result = await this.sendRefundEmail({
          apiKey: resendApiKey,
          from: resendFromEmail,
          to: order.user.email,
          customerName: order.user.name ?? "",
          orderId,
          amount: Number(refund.amount ?? orderChargeTotal(order)),
          note: order.refundNote ?? note,
          refundPending: refundStatus === "PENDING",
          siteUrl,
          logoUrl,
        });
        await this.orderRepository.updateOrderFields(orderId, {
          refundEmailId: result.id,
          refundEmailSentAt: new Date(),
        });
        emailSent = true;
      } catch (error: any) {
        emailError = error.message;
      }
    }

    return {
      order: await this.orderService.getOrder(orderId, actor),
      refundStatus,
      refundedAmount: Number(refund.amount ?? orderChargeTotal(order)),
      emailSent,
      emailError,
    };
  }

  private async sendRefundEmail(input: {
    apiKey: string;
    from: string;
    to: string;
    customerName: string;
    orderId: number;
    amount: number;
    note: string;
    refundPending: boolean;
    siteUrl: string;
    logoUrl: string;
  }): Promise<{ id: string }> {
    const greeting = input.customerName ? `Hola ${input.customerName},` : "Hola,";
    const subject = `Actualización de tu pedido #${input.orderId}`;
    const statusText = input.refundPending
      ? "El reintegro total fue solicitado y está pendiente de confirmación por Mercado Pago."
      : "Mercado Pago confirmó el reintegro total.";
    const { html, text } = renderBrandedEmail(
      {
        subject,
        preheader: "Tenemos novedades sobre tu pedido y su reintegro.",
        greeting,
        heading: `Una actualización de tu pedido #${input.orderId}`,
        paragraphs: [
          `No podremos completar tu pedido porque faltan estos productos: ${input.note}`,
          statusText,
          `Importe reintegrado: $${input.amount.toFixed(2)} ARS.`,
        ],
        action: {
          label: "Ver mi pedido",
          url: new URL(`/mi-cuenta/pedidos/${input.orderId}`, input.siteUrl).toString(),
        },
      },
      input.logoUrl,
    );

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `refund-order-${input.orderId}`,
      },
      body: JSON.stringify({ from: input.from, to: [input.to], subject, text, html }),
      signal: AbortSignal.timeout(15000),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.id !== "string") {
      throw new ExternalServiceError("Resend", body?.message ?? `HTTP ${response.status}`);
    }
    return { id: body.id };
  }

  /** Aplica un pago (ya obtenido de la API de Mercado Pago) a su orden. Idempotente. */
  private async applyPayment(payment: any) {
    const orderId = Number(payment?.external_reference);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      log.warn({ paymentId: payment?.id, externalReference: payment?.external_reference, status: payment?.status }, `Pago ${payment?.id} sin external_reference de orden; se ignora`);
      return;
    }
    const mapped = STATUS_MAP[payment.status] ?? "PENDING";
    const paymentId = String(payment.id);

    let justPaid = false;
    await this.orderRepository.withTransaction(async (tx: any) => {
      await tx.$executeRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        log.warn({ orderId, paymentId }, `Pago ${paymentId} apunta a la orden ${orderId}, que no existe`);
        return;
      }

      // Ya pagada con OTRO pago: no la pisamos con intentos viejos/rechazados
      if (order.paymentStatus === "APPROVED" && order.paymentId && order.paymentId !== paymentId) {
        if (mapped === "APPROVED") {
          log.error(
            { orderId, paymentId, existingPaymentId: order.paymentId, amount: payment.transaction_amount, alert: "duplicate_payment" },
            `Orden ${orderId}: pago duplicado ${paymentId} (ya pagada con ${order.paymentId}); revisar reintegro`,
          );
        } else {
          log.debug({ orderId, paymentId, mpStatus: payment.status }, "Pago viejo de una orden ya pagada; se ignora");
        }
        return;
      }

      const fields: Record<string, any> = {
        paymentStatus: mapped,
        paymentId,
        paymentStatusDetail: payment.status_detail ?? null,
      };
      if (mapped === "REFUNDED") {
        fields.refundStatus = "APPROVED";
        fields.refundedAt = new Date();
      }
      // Reintegros: Mercado Pago es la fuente (incluye los hechos desde su panel)
      if (mapped === "APPROVED" || mapped === "REFUNDED") {
        fields.paidAmount = round2(Number(payment.transaction_amount) || 0);
        fields.refundedAmount = round2(Number(payment.transaction_amount_refunded) || 0);
        if (mapped === "REFUNDED") fields.refundAmount = fields.refundedAmount;
      }

      if (mapped === "APPROVED") {
        const paid = Number(payment.transaction_amount);
        if (payment.currency_id !== "ARS" || !(paid + 0.01 >= chargeTotal(order))) {
          // No debería pasar (el importe lo fija la preferencia): lo dejamos para revisión manual
          log.error(
            { orderId, paymentId, currency: payment.currency_id, paid, expected: chargeTotal(order), alert: "amount_mismatch" },
            `Orden ${orderId}: pago ${paymentId} por ${payment.currency_id} ${paid} ≠ total ${chargeTotal(order)}`,
          );
          fields.paymentStatus = "IN_PROCESS";
          fields.paymentStatusDetail = "amount_mismatch";
        } else {
          fields.paidAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
          if (order.status === "PENDING") fields.status = "PROCESSING";
          if (order.status === "CANCELLED") {
            fields.paymentStatusDetail = "paid_after_cancel";
            log.error({ orderId, paymentId, paid, alert: "paid_after_cancel" }, `Orden ${orderId} cancelada pero pagada (${paymentId}): hay que reintegrar el pago`);
          }
        }
      }

      await tx.order.update({ where: { id: orderId }, data: fields });
      const changed =
        order.paymentStatus !== fields.paymentStatus || order.paymentId !== paymentId || (!!fields.status && fields.status !== order.status);
      const details = {
        orderId,
        paymentId,
        mpStatus: payment.status,
        mpStatusDetail: payment.status_detail,
        paymentMethod: payment.payment_method_id,
        paymentType: payment.payment_type_id,
        amount: payment.transaction_amount,
        paymentStatus: { from: order.paymentStatus, to: fields.paymentStatus },
        ...(fields.status ? { orderStatus: { from: order.status, to: fields.status } } : {}),
      };
      if (changed) {
        log.info(details, `Orden ${orderId}: pago ${paymentId} ${payment.status} (${order.paymentStatus} → ${fields.paymentStatus})`);
      } else {
        log.debug(details, `Orden ${orderId}: pago ${paymentId} sin cambios (${fields.paymentStatus})`);
      }
      // Primer pago aprobado de una orden activa: mail de confirmación (una sola vez)
      justPaid = fields.paymentStatus === "APPROVED" && order.paymentStatus !== "APPROVED" && order.status !== "CANCELLED";
    });
    if (justPaid) {
      log.info({ orderId, paymentId, amount: payment.transaction_amount, event: "order_paid" }, `Orden ${orderId} pagada con Mercado Pago`);
      orderMails.notify("paid", orderId);
    }
  }

  /** Pago de Mercado Pago de una orden, consultado en vivo. */
  private async fetchOrderPayment(order: any) {
    if (order.paymentType !== "MERCADOPAGO") {
      throw new ConflictError("Este pedido no se cobró con Mercado Pago: el reintegro se hace por fuera del sistema");
    }
    if (!order.paymentId) throw new ConflictError("El pedido no tiene un pago de Mercado Pago registrado");
    try {
      return await mpRequest(`/v1/payments/${encodeURIComponent(order.paymentId)}`);
    } catch (err: any) {
      throw new ExternalServiceError("Mercado Pago", err.message);
    }
  }

  /**
   * Cuánto se cobró, cuánto se devolvió y cuánto conviene devolver.
   * Sugerido: lo cobrado de más respecto del total actual del pedido (ítems
   * devueltos o cancelados), o todo lo que queda si el pedido está cancelado.
   */
  async refundInfo(orderId: number, actor: Actor) {
    this.ensureConfigured();
    const order = await this.orderService.getOrder(orderId, actor);
    const payment = await this.fetchOrderPayment(order);
    const paid = round2(Number(payment.transaction_amount) || 0);
    const refunded = round2(Number(payment.transaction_amount_refunded) || 0);
    const refundable = payment.status === "approved" ? round2(Math.max(0, paid - refunded)) : 0;
    const owed = order.status === "CANCELLED" ? refundable : round2(paid - refunded - chargeTotal(order));
    return {
      paymentId: String(payment.id),
      paymentStatus: payment.status as string,
      paid,
      refunded,
      refundable,
      currentTotal: chargeTotal(order),
      suggested: round2(Math.min(refundable, Math.max(0, owed))),
      refunds: order.refunds ?? [],
    };
  }

  /**
   * Reintegra al cliente (todo lo que queda, o `amount` si es parcial) por
   * Mercado Pago. No toca stock ni ítems: eso se hace antes, devolviendo o
   * cancelando los productos del pedido.
   */
  async refund(orderId: number, data: { amount?: number | string; reason?: string }, actor: Actor) {
    const info = await this.refundInfo(orderId, actor);
    if (info.paymentStatus !== "approved") {
      throw new ConflictError(
        info.paymentStatus === "refunded"
          ? "El pago ya se devolvió completo"
          : `El pago no está aprobado (estado en Mercado Pago: ${info.paymentStatus})`,
      );
    }
    const amount = data?.amount == null || data.amount === "" ? info.refundable : round2(Number(data.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError("El monto a devolver tiene que ser mayor a 0");
    if (amount > info.refundable + 0.001) {
      throw new BadRequestError(`Se puede devolver como máximo $${info.refundable} (cobrado $${info.paid}, ya devuelto $${info.refunded})`);
    }
    const total = info.refunded === 0 && amount === info.refundable;
    const reason = typeof data?.reason === "string" ? data.reason.trim().slice(0, 300) || null : null;

    // La misma operación repetida (doble clic, reintento) usa la misma clave:
    // Mercado Pago devuelve el mismo reintegro en vez de hacer otro.
    const cents = (n: number) => Math.round(n * 100);
    const idempotencyKey = `refund-${orderId}-${info.paymentId}-${cents(info.refunded)}-${cents(amount)}`;
    let mpRefund: any;
    try {
      mpRefund = await mpRequest(`/v1/payments/${encodeURIComponent(info.paymentId)}/refunds`, {
        method: "POST",
        // Sin monto = reintegro total
        body: total ? {} : { amount },
        idempotencyKey,
      });
    } catch (err: any) {
      throw new ExternalServiceError("Mercado Pago", err.message);
    }

    await this.orderRepository.saveRefund({
      orderId,
      paymentId: info.paymentId,
      mpRefundId: String(mpRefund.id),
      amount: round2(Number(mpRefund.amount ?? amount)),
      status: String(mpRefund.status ?? "approved"),
      reason,
      createdBy: actor.userId ?? null,
    });
    log.info(
      { orderId, paymentId: info.paymentId, refundId: String(mpRefund.id), amount, total, by: actor.userId, event: "payment_refunded" },
      `Orden ${orderId}: reintegro ${total ? "total" : "parcial"} por $${amount}`,
    );

    // Estado actualizado del pago (refunded / approved con partially_refunded)
    try {
      await this.applyPayment(await mpRequest(`/v1/payments/${encodeURIComponent(info.paymentId)}`));
    } catch (err: any) {
      log.warn({ orderId, ...errInfo(err) }, `Orden ${orderId}: no se pudo refrescar el pago tras el reintegro`);
    }
    orderMails.notify("refunded", orderId, { amount: round2(Number(mpRefund.amount ?? amount)) });
    return this.orderService.getOrder(orderId, actor);
  }

  /**
   * Cancela las órdenes de Mercado Pago que no se pagaron a tiempo (libera el stock).
   * Antes de cancelar vuelve a consultar Mercado Pago por si el webhook se perdió.
   */
  async expireUnpaidOrders() {
    if (!isMercadoPagoConfigured()) return 0;
    const { orderTtlHours } = mpConfig();
    // 1 h de margen sobre el vencimiento de la preferencia
    const cutoff = new Date(Date.now() - (orderTtlHours + 1) * 3600_000);
    const stale = await this.orderRepository.findUnpaidMercadoPagoOrders(cutoff);

    let cancelled = 0;
    if (stale.length) log.info({ count: stale.length, cutoff }, `Revisando ${stale.length} pedido(s) de Mercado Pago vencidos`);
    for (const { id } of stale) {
      try {
        const order = await this.syncOrder(id, SYSTEM_ACTOR);
        if (order.status !== "PENDING" || PAYMENT_LOCKED.includes(order.paymentStatus)) continue;
        await this.orderService.updateOrder(id, { status: "CANCELLED" } as any, SYSTEM_ACTOR);
        cancelled++;
        log.info({ orderId: id }, `Orden ${id} cancelada por falta de pago (stock liberado)`);
      } catch (err: any) {
        log.warn({ orderId: id, ...errInfo(err) }, `No se pudo vencer la orden ${id}`);
      }
    }
    if (cancelled) log.info({ cancelled }, `${cancelled} pedido(s) sin pagar cancelados`);
    return cancelled;
  }
}
