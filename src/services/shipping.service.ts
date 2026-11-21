import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { isUberConfigured, uberCancelDelivery, uberCreateDelivery, uberGetDelivery } from "../config/uber.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ExternalServiceError } from "../errors/infra/ExternalServiceError.js";
import { FINAL_SHIPMENT_STATUSES, ShipmentService } from "./shipment.service.js";
import { dropoffAddress, pickupInfo } from "./shipping-quote.service.js";
import { errInfo, getLogger } from "../config/logger.js";

const log = getLogger("shipping");

export const DEFAULT_SHIPPING_DEPARTMENTS = [
  "Godoy Cruz",
  "Capital",
  "Guaymallén",
  "Las Heras",
  "Luján",
  "Maipú",
];

export type ShippingQuoteZone = { name: string; price: number; etaMinutes: number | null };

/** Compatibilidad para consumidores que validan una tarifa propia sin llamar al proveedor. */
export function quoteShippingZone(zone: ShippingQuoteZone | null, requestedZone: string | null) {
  if (!requestedZone) {
    return {
      available: false,
      provider: null,
      price: 0,
      currency: "ARS" as const,
      etaMinutes: null,
      zone: null,
      providerQuoteId: null,
      reason: "Guardá un domicilio para calcular el envío",
    };
  }
  if (!zone) {
    return {
      available: false,
      provider: null,
      price: 0,
      currency: "ARS" as const,
      etaMinutes: null,
      zone: requestedZone,
      providerQuoteId: null,
      reason: "Todavía no tenemos envíos habilitados para este departamento",
    };
  }
  return {
    available: true,
    provider: "own" as const,
    price: zone.price,
    currency: "ARS" as const,
    etaMinutes: zone.etaMinutes,
    zone: zone.name,
    providerQuoteId: null,
    reason: null,
  };
}

/** Estado de Uber Direct → estado del envío. `canceled` no mueve el envío (se puede volver a pedir). */
const UBER_STATUS: Record<string, string | null> = {
  pending: "PREPARING",
  pickup: "PREPARING",
  pickup_complete: "SHIPPED",
  dropoff: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  returned: "RETURNED",
  canceled: null,
};

const UBER_TEXT: Record<string, string> = {
  pending: "Buscando repartidor",
  pickup: "El repartidor va camino al local",
  pickup_complete: "El repartidor retiró tu pedido",
  dropoff: "Tu pedido está en camino",
  delivered: "Pedido entregado",
  returned: "El pedido volvió al local",
  canceled: "El envío con el repartidor fue cancelado",
};

/** Camino normal de un envío a domicilio, para avanzar paso a paso hasta el estado del proveedor. */
const DELIVERY_PATH = ["PENDING", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

/**
 * Despacho con proveedores de mensajería (Uber Direct). El staff pide el
 * repartidor desde el dashboard cuando el pedido está listo.
 */
export class ShippingService {
  constructor(
    private readonly shipments = new ShipmentService(),
    private readonly prisma: any = sharedPrisma,
  ) {}

  providers() {
    return { uber: isUberConfigured() };
  }

  private async load(id: number) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { order: { include: { orderItems: true } } },
    });
    if (!shipment) throw new NotFoundError("Envío no encontrado");
    return shipment;
  }

  /** Pide un repartidor a Uber Direct para el envío. */
  async dispatch(id: number) {
    if (!isUberConfigured()) {
      throw new ConflictError("Uber Direct no está configurado (faltan UBER_DIRECT_CUSTOMER_ID / CLIENT_ID / CLIENT_SECRET)");
    }
    const s = await this.load(id);
    if (s.method !== "DELIVERY") throw new ConflictError("Solo los envíos a domicilio se despachan con repartidor");
    if (FINAL_SHIPMENT_STATUSES.includes(s.status)) throw new ConflictError(`El envío ya está ${s.status}`);
    if (s.providerDeliveryId && s.providerStatus !== "canceled") {
      throw new ConflictError("El envío ya tiene un repartidor solicitado");
    }
    if (!s.address || !s.phone) throw new ConflictError("Al envío le falta dirección o teléfono");

    const pickup = pickupInfo();
    const items = (s.order?.orderItems ?? [])
      .filter((it: any) => !["CANCELLED", "RETURNED"].includes(it.status) && it.quantity > 0)
      .map((it: any) => ({
        name: [it.productNameSnapshot, it.variantNameSnapshot].filter(Boolean).join(" - "),
        quantity: it.selectedBulkOption ? it.quantity : 1,
      }));

    let delivery;
    try {
      delivery = await uberCreateDelivery({
        externalId: `order-${s.orderId}`,
        pickup: pickup.address,
        pickupName: pickup.name,
        pickupPhone: pickup.phone,
        dropoff: dropoffAddress({ street: s.address, number: "", city: s.city, province: s.province, postalCode: s.postalCode, zone: s.zone }),
        dropoffName: s.recipientName || "Cliente",
        dropoffPhone: s.phone,
        dropoffNotes: s.notes,
        items: items.length ? items : [{ name: `Pedido #${s.orderId}`, quantity: 1 }],
        value: Number(s.order?.totalPrice) || undefined,
      });
    } catch (err: any) {
      log.error({ shipmentId: id, orderId: s.orderId, ...errInfo(err) }, `No se pudo pedir repartidor de Uber para el envío ${id}`);
      throw new ExternalServiceError("Uber Direct", err.message);
    }
    log.info(
      { shipmentId: id, orderId: s.orderId, deliveryId: delivery.id, uberStatus: delivery.status, fee: delivery.fee, event: "uber_dispatched" },
      `Repartidor de Uber pedido para la orden ${s.orderId}`,
    );

    await this.prisma.shipment.update({
      where: { id },
      data: {
        provider: "uber",
        carrier: "Uber Direct",
        providerDeliveryId: delivery.id,
        providerStatus: delivery.status,
        carrierTrackingCode: delivery.id,
        carrierTrackingUrl: delivery.trackingUrl,
      },
    });
    await this.advanceTo(id, UBER_STATUS[delivery.status] ?? "PREPARING", "Pedimos un repartidor para tu pedido");
    return this.shipments.findOne(id);
  }

  /** Consulta el estado en Uber y lo refleja en el envío (con su historial). */
  async sync(id: number) {
    const s = await this.load(id);
    if (s.provider !== "uber" || !s.providerDeliveryId) throw new ConflictError("El envío no tiene un repartidor de Uber");
    let delivery;
    try {
      delivery = await uberGetDelivery(s.providerDeliveryId);
    } catch (err: any) {
      throw new ExternalServiceError("Uber Direct", err.message);
    }
    await this.applyProviderStatus(s, delivery.status, delivery.trackingUrl);
    return this.shipments.findOne(id);
  }

  async cancel(id: number) {
    const s = await this.load(id);
    if (s.provider !== "uber" || !s.providerDeliveryId) throw new ConflictError("El envío no tiene un repartidor de Uber");
    try {
      const delivery = await uberCancelDelivery(s.providerDeliveryId);
      await this.applyProviderStatus(s, delivery.status || "canceled", delivery.trackingUrl);
      log.info({ shipmentId: id, orderId: s.orderId, deliveryId: s.providerDeliveryId }, `Repartidor de Uber cancelado (envío ${id})`);
    } catch (err: any) {
      throw new ExternalServiceError("Uber Direct", err.message);
    }
    return this.shipments.findOne(id);
  }

  /** Sincroniza todos los envíos de Uber en curso (lo llama un timer del servidor). */
  async syncActive() {
    if (!isUberConfigured()) return 0;
    const active = await this.prisma.shipment.findMany({
      where: {
        provider: "uber",
        providerDeliveryId: { not: null },
        status: { notIn: FINAL_SHIPMENT_STATUSES },
        NOT: { providerStatus: "canceled" },
      },
      select: { id: true },
    });
    for (const { id } of active) {
      await this.sync(id).catch((err) => log.warn({ shipmentId: id, ...errInfo(err) }, `No se pudo sincronizar el envío ${id}`));
    }
    return active.length;
  }

  private async applyProviderStatus(s: any, providerStatus: string, trackingUrl: string | null) {
    if (providerStatus !== s.providerStatus || (trackingUrl && trackingUrl !== s.carrierTrackingUrl)) {
      await this.prisma.shipment.update({
        where: { id: s.id },
        data: { providerStatus, ...(trackingUrl ? { carrierTrackingUrl: trackingUrl } : {}) },
      });
    }
    if (providerStatus === s.providerStatus) return;
    const target = UBER_STATUS[providerStatus];
    log.info(
      { shipmentId: s.id, orderId: s.orderId, uberStatus: { from: s.providerStatus, to: providerStatus }, shipmentStatus: target ?? s.status },
      `Envío ${s.id}: Uber ${s.providerStatus ?? "-"} → ${providerStatus}`,
    );
    if (target) await this.advanceTo(s.id, target, UBER_TEXT[providerStatus]);
  }

  /** Avanza el envío hasta `target` pasando por los estados intermedios permitidos. */
  private async advanceTo(id: number, target: string, description?: string) {
    const current: any = await this.prisma.shipment.findUnique({ where: { id }, select: { status: true } });
    if (!current || current.status === target || FINAL_SHIPMENT_STATUSES.includes(current.status)) return;

    const from = DELIVERY_PATH.indexOf(current.status);
    const to = DELIVERY_PATH.indexOf(target);
    const steps = from >= 0 && to > from ? DELIVERY_PATH.slice(from + 1, to + 1) : [target];
    for (const status of steps) {
      await this.shipments.addEvent(id, {
        status,
        description: status === target ? description : undefined,
        location: undefined,
      } as any);
    }
  }
}
