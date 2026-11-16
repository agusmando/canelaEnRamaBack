import crypto from "node:crypto";
import { isMercadoPagoConfigured, mpConfig, mpRequest } from "../config/mercadopago.js";
import { OrderRepository } from "../repository/order.repository.js";
import { OrderService } from "./order.service.js";
import { PricingService } from "./pricing.service.js";
import type { Actor } from "../middleware/auth.middleware.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { ExternalServiceError } from "../errors/infra/ExternalServiceError.js";

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

const SYSTEM_ACTOR: Actor = { userId: "system:mercadopago", roles: ["ADMIN"], isStaff: true };
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
    const total = round2(Number(order.totalPrice));
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
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err: any) {
      throw new ExternalServiceError("Mercado Pago", err.message);
    }

    await this.orderRepository.updateOrderFields(order.id, { paymentPreferenceId: pref.id });
    return {
      preferenceId: pref.id as string,
      initPoint: pref.init_point as string,
      sandboxInitPoint: (pref.sandbox_init_point ?? null) as string | null,
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

    const sum = round2(lines.reduce((s: number, l: any) => s + l.amount, 0));
    if (lines.length && sum === total) {
      return lines.map(({ it, amount }: any) => ({
        id: String(it.productVariantId ?? it.id),
        title: `${it.productNameSnapshot}${it.variantNameSnapshot ? ` - ${it.variantNameSnapshot}` : ""}`.slice(0, 250),
        description: it.selectedBulkOption ? `${it.quantity} x ${it.selectedBulkOption}` : `Cantidad: ${it.quantity}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: round2(amount),
      }));
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
      throw new ExternalServiceError("Mercado Pago", err.message);
    }
    const best =
      results.find((p) => p.status === "approved") ??
      results.find((p) => ["in_process", "authorized", "in_mediation"].includes(p.status)) ??
      results[0];
    if (best) await this.applyPayment(best);
    return this.orderService.getOrder(orderId, actor);
  }

  /** Aplica un pago (ya obtenido de la API de Mercado Pago) a su orden. Idempotente. */
  private async applyPayment(payment: any) {
    const orderId = Number(payment?.external_reference);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      console.warn(`[payment] pago ${payment?.id} sin external_reference de orden; se ignora`);
      return;
    }
    const mapped = STATUS_MAP[payment.status] ?? "PENDING";
    const paymentId = String(payment.id);

    await this.orderRepository.withTransaction(async (tx: any) => {
      await tx.$executeRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        console.warn(`[payment] pago ${paymentId} apunta a la orden ${orderId}, que no existe`);
        return;
      }

      // Ya pagada con OTRO pago: no la pisamos con intentos viejos/rechazados
      if (order.paymentStatus === "APPROVED" && order.paymentId && order.paymentId !== paymentId) {
        if (mapped === "APPROVED") {
          console.warn(`[payment] orden ${orderId}: pago duplicado ${paymentId} (ya pagada con ${order.paymentId}); revisar reintegro`);
        }
        return;
      }

      const fields: Record<string, any> = {
        paymentStatus: mapped,
        paymentId,
        paymentStatusDetail: payment.status_detail ?? null,
      };

      if (mapped === "APPROVED") {
        const paid = Number(payment.transaction_amount);
        if (payment.currency_id !== "ARS" || !(paid + 0.01 >= Number(order.totalPrice))) {
          // No debería pasar (el importe lo fija la preferencia): lo dejamos para revisión manual
          console.error(`[payment] orden ${orderId}: pago ${paymentId} por ${payment.currency_id} ${paid} ≠ total ${order.totalPrice}`);
          fields.paymentStatus = "IN_PROCESS";
          fields.paymentStatusDetail = "amount_mismatch";
        } else {
          fields.paidAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
          if (order.status === "PENDING") fields.status = "PROCESSING";
          if (order.status === "CANCELLED") {
            fields.paymentStatusDetail = "paid_after_cancel";
            console.warn(`[payment] orden ${orderId} cancelada pero pagada (${paymentId}): hay que reintegrar el pago`);
          }
        }
      }

      await tx.order.update({ where: { id: orderId }, data: fields });
    });
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
    for (const { id } of stale) {
      try {
        const order = await this.syncOrder(id, SYSTEM_ACTOR);
        if (order.status !== "PENDING" || PAYMENT_LOCKED.includes(order.paymentStatus)) continue;
        await this.orderService.updateOrder(id, { status: "CANCELLED" } as any, SYSTEM_ACTOR);
        cancelled++;
      } catch (err: any) {
        console.warn(`[payment] no se pudo vencer la orden ${id}:`, err.message);
      }
    }
    if (cancelled) console.info(`[payment] ${cancelled} pedido(s) sin pagar cancelados`);
    return cancelled;
  }
}
