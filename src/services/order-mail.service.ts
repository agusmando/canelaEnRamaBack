import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { emailLayout, escapeHtml, sendMail } from "../config/mailer.js";
import { pickupInfo } from "./shipping-quote.service.js";
import { getLogger, errInfo } from "../config/logger.js";

const log = getLogger("mail");

/**
 * Mails al cliente sobre su pedido. Se mandan DESPUÉS de confirmar la
 * transacción y nunca hacen fallar la operación que los dispara.
 *
 *   received  pedido recibido (efectivo/transferencia/tarjeta en el local)
 *   paid      pago acreditado en Mercado Pago (hace de confirmación del pedido)
 *   ready     listo para retirar en el local
 *   onTheWay  en camino (envío a domicilio)
 *   failedAttempt  el repartidor no pudo entregarlo
 *   delivered entregado / retirado
 *   updated   la tienda cambió productos del pedido (devoluciones, sin stock o a la espera de reposición)
 *   refunded  reintegro (total o parcial) por Mercado Pago
 *   cancelled pedido cancelado (por la tienda, por el cliente o por falta de pago)
 */
export type OrderMailKind =
  | "received"
  | "paid"
  | "ready"
  | "onTheWay"
  | "failedAttempt"
  | "delivered"
  | "updated"
  | "refunded"
  | "cancelled";

/** Datos extra de algunos mails (p. ej. el monto reintegrado o los ítems tocados). */
export type OrderMailExtra = { amount?: number; itemIds?: number[] };

const PAYMENT_LABEL: Record<string, string> = {
  DEBIT: "Tarjeta de débito",
  CREDIT: "Tarjeta de crédito",
  CASH: "Efectivo o transferencia (al retirar)",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
};

const money = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 250 → "250 g", 1500 → "1,5 kg" (KG); unidades → "3 u". */
const qtyLabel = (amount: number, measure?: string | null) => {
  if (measure === "KG" || measure === "G") {
    return amount >= 1000 ? `${(amount / 1000).toLocaleString("es-AR")} kg` : `${amount.toLocaleString("es-AR")} g`;
  }
  return `${amount.toLocaleString("es-AR")} u`;
};

export const itemLabel = (it: {
  quantity: number;
  selectedBulkOption?: number | null;
  productVariant?: { contentMeasure?: string | null } | null;
}) => {
  const m = it.productVariant?.contentMeasure;
  return it.selectedBulkOption
    ? `${it.quantity} × ${qtyLabel(Number(it.selectedBulkOption), m)}`
    : qtyLabel(it.quantity, m);
};

/** Total de la línea a partir de los snapshots (mismo cálculo que PricingService.lineTotal). */
export const itemTotal = (it: any) => {
  if (it.status === "CANCELLED" || it.status === "RETURNED" || it.status === "OUT_OF_STOCK") return 0;
  const units = it.selectedBulkOption ? it.quantity * it.selectedBulkOption : it.quantity;
  const priceUnits = it.productVariant?.contentMeasure === "KG" ? units / 1000 : units;
  return round2(Math.max(0, it.unitPriceSnapshot * priceUnits - Number(it.discountAppliedSnapshot ?? 0)));
};

const webUrl = () => (process.env.WEB_URL || "https://canelaenrama.com.ar").replace(/\/+$/, "");

const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${html}</p>`;

function itemsTable(order: any) {
  const rows = (order.orderItems ?? [])
    .filter((it: any) => it.status !== "CANCELLED" && it.status !== "RETURNED" && it.status !== "OUT_OF_STOCK")
    .map(
      (it: any) => `<tr>
        <td style="padding:6px 0;font-size:14px">${escapeHtml(it.productNameSnapshot)}${
          it.variantNameSnapshot ? ` <span style="color:#666">· ${escapeHtml(it.variantNameSnapshot)}</span>` : ""
        }<br><span style="color:#666;font-size:13px">${escapeHtml(itemLabel(it))}</span></td>
        <td style="padding:6px 0;font-size:14px;text-align:right;white-space:nowrap">${money(itemTotal(it))}</td>
      </tr>`,
    )
    .join("");
  const shipping = Number(order.shippingCost) || 0;
  const coupon = Number(order.couponDiscount) || 0;
  const total = round2(Number(order.totalPrice || 0) - coupon + shipping);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-top:1px solid #eee;border-bottom:1px solid #eee">
      ${rows}
      ${
        coupon > 0 && order.couponCode
          ? `<tr><td style="padding:6px 0;font-size:14px">Cupón ${escapeHtml(order.couponCode)}</td><td style="padding:6px 0;font-size:14px;text-align:right">−${money(coupon)}</td></tr>`
          : ""
      }
      ${
        order.shippingMethod === "DELIVERY"
          ? `<tr><td style="padding:6px 0;font-size:14px">Envío${order.shippingZone ? ` a ${escapeHtml(order.shippingZone)}` : ""}</td><td style="padding:6px 0;font-size:14px;text-align:right">${shipping ? money(shipping) : "Gratis"}</td></tr>`
          : ""
      }
      <tr><td style="padding:8px 0;font-size:15px;font-weight:bold">Total</td><td style="padding:8px 0;font-size:15px;font-weight:bold;text-align:right">${money(total)}</td></tr>
    </table>`;
}

function deliveryText(order: any) {
  if (order.shippingMethod === "DELIVERY") {
    const s = order.shipment;
    const where = s ? [s.address, s.city].filter(Boolean).join(", ") : order.shippingZone;
    return `Envío a domicilio${where ? `: ${escapeHtml(where)}` : ""}.`;
  }
  const pickup = pickupInfo();
  return `Retiro en el local: ${escapeHtml(pickup.address.street)}, ${escapeHtml(pickup.address.city)}.`;
}

const dateLabel = (d: string | Date) =>
  new Date(d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

/**
 * Ajuste por stock al confirmar el pedido: líneas que quedaron afuera por no
 * haber stock y líneas con la cantidad reducida a lo disponible.
 */
function stockChanges(order: any) {
  const items = order.orderItems ?? [];
  const line = (it: any) =>
    `${escapeHtml(it.productNameSnapshot)}${it.variantNameSnapshot ? ` · ${escapeHtml(it.variantNameSnapshot)}` : ""}`;
  const removed = items.filter((it: any) => it.status === "OUT_OF_STOCK");
  const reduced = items.filter((it: any) => it.status === "PARTIALLY_RETURNED");
  let html = "";
  if (removed.length) {
    html += p(`<strong>Sin stock, lo sacamos del pedido</strong> (no se cobra):<br>${removed.map(line).join("<br>")}`);
  }
  if (reduced.length) {
    html += p(
      `<strong>Ajustamos la cantidad al stock disponible</strong>:<br>${reduced
        .map((it: any) => `${line(it)} <span style="color:#666">(quedó en ${escapeHtml(itemLabel(it))})</span>`)
        .join("<br>")}`,
    );
  }
  return html;
}

/** Líneas que la tienda tocó en esta actualización (o todas las pendientes si no se indica). */
function changesList(order: any, itemIds?: number[]) {
  const line = (it: any) =>
    `${escapeHtml(it.productNameSnapshot)}${it.variantNameSnapshot ? ` · ${escapeHtml(it.variantNameSnapshot)}` : ""}`;
  const all = order.orderItems ?? [];
  const items = itemIds?.length ? all.filter((it: any) => itemIds.includes(it.id)) : all;
  const interesting = items.filter((it: any) =>
    ["CANCELLED", "RETURNED", "PARTIALLY_RETURNED", "AWAITING_STOCK"].includes(it.status),
  );
  const cancelled = interesting.filter((it: any) => it.status === "CANCELLED");
  const returned = interesting.filter((it: any) => it.status === "RETURNED");
  const adjusted = interesting.filter((it: any) => it.status === "PARTIALLY_RETURNED");
  const waiting = interesting.filter((it: any) => it.status === "AWAITING_STOCK");
  let html = "";
  if (cancelled.length) {
    html += p(`<strong>Los sacamos del pedido</strong> (no se cobran):<br>${cancelled.map(line).join("<br>")}`);
  }
  if (returned.length) {
    html += p(`<strong>Los devolvimos</strong>:<br>${returned.map(line).join("<br>")}`);
  }
  if (adjusted.length) {
    html += p(
      `<strong>Cantidad reducida</strong>:<br>${adjusted
        .map((it: any) => `${line(it)} <span style="color:#666">(quedó en ${escapeHtml(itemLabel(it))})</span>`)
        .join("<br>")}`,
    );
  }
  if (waiting.length) {
    html += p(
      `<strong>Esperando reposición</strong>:<br>${waiting
        .map((it: any) => line(it) + (it.awaitingStockAt ? ` <span style="color:#666">(llega aprox. el ${escapeHtml(dateLabel(it.awaitingStockAt))})</span>` : ""))
        .join("<br>")}`,
    );
  }
  return html;
}

/** Arma asunto y HTML. Exportado para tests. */
export function buildOrderMail(kind: OrderMailKind, order: any, extra: OrderMailExtra = {}) {
  const n = `#${order.id}`;
  const name = order.user?.name?.trim()?.split(/\s+/)[0];
  const hi = p(name ? `Hola ${escapeHtml(name)},` : "Hola,");
  // Los pedidos de invitado no tienen cuenta: el seguimiento es por código público.
  const guestTracking =
    order.user?.supertokensId?.startsWith("guest:") && order.shipment?.trackingCode
      ? order.shipment.trackingCode
      : null;
  const orderLink = guestTracking
    ? { label: "Seguir mi pedido", href: `${webUrl()}/seguimiento/${guestTracking}` }
    : { label: "Ver mi pedido", href: `${webUrl()}/mi-cuenta/pedidos/${order.id}` };
  const payment = PAYMENT_LABEL[order.paymentType] ?? order.paymentType;

  switch (kind) {
    case "received":
      return {
        subject: `Recibimos tu pedido ${n} · Canela en Rama`,
        html: emailLayout({
          title: `¡Gracias! Recibimos tu pedido ${n}`,
          body:
            hi +
            p("Ya lo estamos preparando. Te avisamos por mail cuando esté listo.") +
            stockChanges(order) +
            itemsTable(order) +
            p(`<strong>Pago:</strong> ${escapeHtml(payment)}.<br><strong>Entrega:</strong> ${deliveryText(order)}`),
          button: orderLink,
        }),
      };
    case "paid":
      return {
        subject: `Pago acreditado · pedido ${n}`,
        html: emailLayout({
          title: `Recibimos tu pago del pedido ${n}`,
          body:
            hi +
            p("Mercado Pago nos confirmó el pago. Ya estamos preparando tu pedido y te avisamos cuando esté listo.") +
            stockChanges(order) +
            itemsTable(order) +
            p(`<strong>Entrega:</strong> ${deliveryText(order)}`),
          button: orderLink,
        }),
      };
    case "ready": {
      const pickup = pickupInfo();
      return {
        subject: `Tu pedido ${n} está listo para retirar`,
        html: emailLayout({
          title: `Tu pedido ${n} está listo`,
          body:
            hi +
            p(
              `Ya podés pasar a buscarlo por <strong>${escapeHtml(pickup.address.street)}, ${escapeHtml(pickup.address.city)}</strong>.` +
                (order.paymentStatus === "APPROVED" ? " El pedido ya está pago." : ` Forma de pago: ${escapeHtml(payment)}.`),
            ),
          button: orderLink,
        }),
      };
    }
    case "onTheWay": {
      const s = order.shipment;
      const tracking = s?.carrierTrackingUrl || (s?.trackingCode ? `${webUrl()}/seguimiento/${s.trackingCode}` : null);
      return {
        subject: `Tu pedido ${n} está en camino`,
        html: emailLayout({
          title: `Tu pedido ${n} está en camino`,
          body:
            hi +
            p(`Lo despachamos ${s?.carrier ? `con ${escapeHtml(s.carrier)} ` : ""}a ${deliveryText(order).replace(/^Envío a domicilio: /, "")}`) +
            (s?.trackingCode ? p(`Código de seguimiento: <strong>${escapeHtml(s.trackingCode)}</strong>`) : ""),
          button: tracking ? { label: "Seguir mi envío", href: tracking } : orderLink,
        }),
      };
    }
    case "failedAttempt":
      return {
        subject: `No pudimos entregar tu pedido ${n}`,
        html: emailLayout({
          title: `No pudimos entregar tu pedido ${n}`,
          body:
            hi +
            p("Pasamos a entregarlo pero no lo pudimos dejar. Escribinos para coordinar un nuevo horario o cambiar la dirección.") +
            p(`<strong>Entrega:</strong> ${deliveryText(order)}`),
          button: orderLink,
        }),
      };
    case "delivered": {
      const pickup = order.shippingMethod !== "DELIVERY";
      return {
        subject: pickup ? `Retiraste tu pedido ${n} · ¡Gracias!` : `Entregamos tu pedido ${n} · ¡Gracias!`,
        html: emailLayout({
          title: pickup ? `¡Gracias por retirar tu pedido ${n}!` : `Tu pedido ${n} fue entregado`,
          body:
            hi +
            p("Esperamos que lo disfrutes. Si algo no llegó como esperabas, respondé este mail y lo resolvemos.") +
            p("Nos ayuda muchísimo que dejes tu opinión de los productos en la tienda."),
          button: orderLink,
        }),
      };
    }
    case "updated":
      return {
        subject: `Hubo cambios en tu pedido ${n}`,
        html: emailLayout({
          title: `Actualizamos tu pedido ${n}`,
          body:
            hi +
            p("Te contamos los cambios en tu pedido:") +
            changesList(order, extra.itemIds) +
            (order.estimatedReadyAt ? p(`Fecha estimada en que va a estar listo: <strong>${escapeHtml(dateLabel(order.estimatedReadyAt))}</strong>.`) : "") +
            p("Así queda el pedido:") +
            itemsTable(order),
          button: orderLink,
        }),
      };
    case "refunded": {
      const amount = Number(extra.amount ?? 0);
      const total = order.paymentStatus === "REFUNDED";
      return {
        subject: `Te devolvimos ${money(amount)} · pedido ${n}`,
        html: emailLayout({
          title: total ? `Te devolvimos el pago del pedido ${n}` : `Te devolvimos parte del pago del pedido ${n}`,
          body:
            hi +
            p(`Hicimos un reintegro de <strong>${money(amount)}</strong> por Mercado Pago, al mismo medio con el que pagaste.`) +
            p(
              "Si pagaste con dinero en cuenta de Mercado Pago, lo ves al instante. Con tarjeta puede tardar unos días hábiles y, en tarjetas de crédito, aparecer en el resumen siguiente.",
            ),
          button: orderLink,
        }),
      };
    }
    case "cancelled":
      return {
        subject: `Pedido ${n} cancelado`,
        html: emailLayout({
          title: `Cancelamos el pedido ${n}`,
          body:
            hi +
            p(
              order.paymentType === "MERCADOPAGO" && order.paymentStatus !== "APPROVED"
                ? "No recibimos el pago a tiempo, así que el pedido se canceló y los productos volvieron al stock. Si todavía lo querés, podés hacerlo de nuevo desde la tienda."
                : "El pedido quedó cancelado. Si ya lo habías pagado, nos vamos a contactar para devolverte el dinero.",
            ),
          button: { label: "Ir a la tienda", href: webUrl() },
        }),
      };
  }
}

export class OrderMailService {
  constructor(private readonly prisma: any = sharedPrisma) {}

  /** Manda el mail en segundo plano. Nunca tira. */
  notify(kind: OrderMailKind, orderId: number, extra?: OrderMailExtra) {
    this.send(kind, orderId, extra).catch((err) => log.warn({ orderId, kind, ...errInfo(err) }, `Mail de pedido ${orderId} (${kind}) falló`));
  }

  async send(kind: OrderMailKind, orderId: number, extra?: OrderMailExtra): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true, supertokensId: true } },
        orderItems: { include: { productVariant: { select: { contentMeasure: true } } } },
        shipment: true,
      },
    });
    const to = order?.user?.email;
    if (!to) {
      log.warn({ orderId, kind }, `Orden ${orderId} sin email: no se manda el mail "${kind}"`);
      return false;
    }
    log.info({ orderId, kind }, `Mandando el mail "${kind}" de la orden ${orderId}`);
    const { subject, html } = buildOrderMail(kind, order, extra);
    return sendMail({ to, subject, html });
  }
}

export const orderMails = new OrderMailService();
