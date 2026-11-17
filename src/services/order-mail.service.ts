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
 *   cancelled pedido cancelado (por la tienda, por el cliente o por falta de pago)
 */
export type OrderMailKind = "received" | "paid" | "ready" | "onTheWay" | "cancelled";

const PAYMENT_LABEL: Record<string, string> = {
  DEBIT: "Tarjeta de débito",
  CREDIT: "Tarjeta de crédito",
  CASH: "Efectivo",
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
  if (it.status === "CANCELLED" || it.status === "RETURNED") return 0;
  const units = it.selectedBulkOption ? it.quantity * it.selectedBulkOption : it.quantity;
  const priceUnits = it.productVariant?.contentMeasure === "KG" ? units / 1000 : units;
  return round2(Math.max(0, it.unitPriceSnapshot * priceUnits - Number(it.discountAppliedSnapshot ?? 0)));
};

const webUrl = () => (process.env.WEB_URL || "https://canelaenrama.com.ar").replace(/\/+$/, "");

const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${html}</p>`;

function itemsTable(order: any) {
  const rows = (order.orderItems ?? [])
    .filter((it: any) => it.status !== "CANCELLED" && it.status !== "RETURNED")
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
  const total = round2(Number(order.totalPrice || 0) + shipping);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-top:1px solid #eee;border-bottom:1px solid #eee">
      ${rows}
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

/** Arma asunto y HTML. Exportado para tests. */
export function buildOrderMail(kind: OrderMailKind, order: any) {
  const n = `#${order.id}`;
  const name = order.user?.name?.trim()?.split(/\s+/)[0];
  const hi = p(name ? `Hola ${escapeHtml(name)},` : "Hola,");
  const orderLink = { label: "Ver mi pedido", href: `${webUrl()}/mi-cuenta/pedidos/${order.id}` };
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
  notify(kind: OrderMailKind, orderId: number) {
    this.send(kind, orderId).catch((err) => log.warn({ orderId, kind, ...errInfo(err) }, `Mail de pedido ${orderId} (${kind}) falló`));
  }

  async send(kind: OrderMailKind, orderId: number): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        orderItems: { include: { productVariant: { select: { contentMeasure: true } } } },
        shipment: true,
      },
    });
    const to = order?.user?.email;
    if (!to) {
      log.warn({ orderId, kind }, `Orden ${orderId} sin email: no se manda el mail "${kind}"`);
      return false;
    }
    const { subject, html } = buildOrderMail(kind, order);
    return sendMail({ to, subject, html });
  }
}

export const orderMails = new OrderMailService();
