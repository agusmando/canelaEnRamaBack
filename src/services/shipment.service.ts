import { randomInt } from "node:crypto";
import { GenericServiceImpl } from "./generic-impl.service.js";
import {
  CreateShipmentDto,
  CreateShipmentEventDto,
  SHIPMENT_METHODS,
  SHIPMENT_STATUSES,
  ShipmentDto,
  type ShipmentMethod,
  type ShipmentStatus,
  UpdateShipmentDto,
} from "../dto/shipment/shipment.dto.js";
import { ShipmentRepository } from "../repository/shipment.repository.js";
import { OrderRepository } from "../repository/order.repository.js";
import { ORDER_TRANSITIONS } from "./order.service.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import type { Actor } from "../middleware/auth.middleware.js";

export const FINAL_SHIPMENT_STATUSES: ShipmentStatus[] = ["DELIVERED", "RETURNED", "CANCELLED"];

/**
 * Transiciones de estado según el método. Los estados finales no tienen salida.
 *   Retiro:  PENDING → PREPARING → READY_FOR_PICKUP → DELIVERED (retirado)
 *   Envío:   PENDING → PREPARING → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
 *            con FAILED_ATTEMPT (reintento) y RETURNED (vuelve al local)
 */
export const SHIPMENT_TRANSITIONS: Record<ShipmentMethod, Partial<Record<ShipmentStatus, ShipmentStatus[]>>> = {
  PICKUP: {
    PENDING: ["PREPARING", "READY_FOR_PICKUP", "CANCELLED"],
    PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
    READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
  },
  DELIVERY: {
    PENDING: ["PREPARING", "SHIPPED", "CANCELLED"],
    PREPARING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED_ATTEMPT", "RETURNED"],
    OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_ATTEMPT", "RETURNED"],
    FAILED_ATTEMPT: ["OUT_FOR_DELIVERY", "RETURNED", "CANCELLED"],
    DELIVERED: [],
    RETURNED: [],
    CANCELLED: [],
  },
};

/** Descripción por defecto de cada evento (la ve el cliente). */
const DEFAULT_EVENT_TEXT: Record<ShipmentStatus, string> = {
  PENDING: "Recibimos tu pedido",
  PREPARING: "Estamos preparando tu pedido",
  READY_FOR_PICKUP: "Tu pedido está listo para retirar",
  SHIPPED: "Tu pedido fue despachado",
  OUT_FOR_DELIVERY: "Tu pedido está en reparto",
  FAILED_ATTEMPT: "No pudimos entregar tu pedido",
  DELIVERED: "Pedido entregado",
  RETURNED: "El pedido volvió al local",
  CANCELLED: "Envío cancelado",
};

// Sin caracteres ambiguos (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newTrackingCode = () =>
  "CER-" + Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

const TEXT_FIELDS = [
  "carrier",
  "carrierTrackingCode",
  "carrierTrackingUrl",
  "recipientName",
  "phone",
  "address",
  "city",
  "province",
  "postalCode",
  "notes",
] as const;

export class ShipmentService extends GenericServiceImpl<
  ShipmentDto,
  CreateShipmentDto,
  UpdateShipmentDto
> {
  constructor(
    private readonly shipmentRepository = new ShipmentRepository(),
    private readonly orderRepository = new OrderRepository(),
  ) {
    super(shipmentRepository);
  }

  meta() {
    return {
      statuses: SHIPMENT_STATUSES,
      methods: SHIPMENT_METHODS,
      transitions: SHIPMENT_TRANSITIONS,
      finalStatuses: FINAL_SHIPMENT_STATUSES,
    };
  }

  async createShipment(data: CreateShipmentDto) {
    const orderId = Number(data?.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new ValidationError("orderId es obligatorio");
    const fields = this.parseFields(data, true);
    if (fields.method === "DELIVERY" && !fields.address) {
      throw new ValidationError("La dirección es obligatoria para envíos a domicilio");
    }

    return this.shipmentRepository.withTransaction(async (tx) => {
      await this.shipmentRepository.lockOrder(orderId, tx);
      const order = await this.orderRepository.getOrder(orderId, tx);
      if (!order) throw new NotFoundError("Orden no encontrada");
      if (order.status === "CANCELLED") {
        throw new ConflictError("No se puede crear un envío para una orden cancelada");
      }
      if (await this.shipmentRepository.findByOrderId(orderId, tx)) {
        throw new ConflictError("La orden ya tiene un envío");
      }

      let trackingCode = newTrackingCode();
      while (await this.shipmentRepository.trackingCodeExists(trackingCode, tx)) {
        trackingCode = newTrackingCode();
      }

      return this.shipmentRepository.createShipment(
        { ...fields, orderId, trackingCode, status: "PENDING" },
        { status: "PENDING", description: DEFAULT_EVENT_TEXT.PENDING },
        tx,
      );
    });
  }

  async updateShipment(id: number, data: UpdateShipmentDto) {
    const shipment = await this.findOne(id);
    const fields = this.parseFields(data, false);
    if ("status" in (data ?? {})) {
      throw new ValidationError("El estado se cambia agregando un evento (POST /shipment/:id/events)");
    }
    if (fields.method && fields.method !== (shipment as any).method) {
      if ((shipment as any).status !== "PENDING" && (shipment as any).status !== "PREPARING") {
        throw new ConflictError("Solo se puede cambiar el método antes de despachar el pedido");
      }
    }
    const method = fields.method ?? (shipment as any).method;
    const address = "address" in fields ? fields.address : (shipment as any).address;
    if (method === "DELIVERY" && !address) {
      throw new ValidationError("La dirección es obligatoria para envíos a domicilio");
    }
    if (Object.keys(fields).length === 0) return shipment;
    return this.shipmentRepository.updateShipment(id, fields);
  }

  /**
   * Cambia el estado agregando un evento al historial. Mantiene la orden
   * sincronizada: despachado/listo → orden SHIPPED; entregado → orden DELIVERED
   * (solo si esa transición de la orden está permitida).
   */
  async addEvent(id: number, data: CreateShipmentEventDto) {
    const status = String(data?.status ?? "").toUpperCase() as ShipmentStatus;
    if (!SHIPMENT_STATUSES.includes(status)) {
      throw new ValidationError(`status debe ser uno de ${SHIPMENT_STATUSES.join(", ")}`);
    }

    return this.shipmentRepository.withTransaction(async (tx) => {
      const shipment: any = await this.shipmentRepository.getById(id, tx);
      if (!shipment) throw new NotFoundError("Envío no encontrado");
      await this.shipmentRepository.lockOrder(shipment.orderId, tx);

      const allowed = SHIPMENT_TRANSITIONS[shipment.method as ShipmentMethod][shipment.status as ShipmentStatus] ?? [];
      if (!allowed.includes(status)) {
        throw new ConflictError(
          `No se puede pasar de ${shipment.status} a ${status}` +
            (allowed.length ? ` (permitido: ${allowed.join(", ")})` : " (estado final)"),
        );
      }

      const now = new Date();
      const fields: Record<string, any> = { status };
      if ((status === "SHIPPED" || status === "READY_FOR_PICKUP") && !shipment.shippedAt) fields.shippedAt = now;
      if (status === "DELIVERED") fields.deliveredAt = now;

      const updated = await this.shipmentRepository.updateShipment(
        id,
        fields,
        {
          status,
          description: this.cleanText(data.description) ?? DEFAULT_EVENT_TEXT[status],
          location: this.cleanText(data.location),
        },
        tx,
      );

      const orderStatus = shipment.order?.status;
      const targetOrderStatus =
        status === "DELIVERED"
          ? "DELIVERED"
          : status === "SHIPPED" || status === "READY_FOR_PICKUP"
            ? "SHIPPED"
            : null;
      if (
        targetOrderStatus &&
        orderStatus !== targetOrderStatus &&
        (ORDER_TRANSITIONS[orderStatus] ?? []).includes(targetOrderStatus)
      ) {
        await this.orderRepository.updateOrderFields(shipment.orderId, { status: targetOrderStatus }, tx);
      }

      return updated;
    });
  }

  /** Envío de una orden: el cliente solo ve el de sus propias órdenes. */
  async findByOrder(orderId: number, actor: Actor) {
    const shipment: any = await this.shipmentRepository.findByOrderId(orderId);
    if (!shipment) throw new NotFoundError("La orden no tiene envío");
    if (!actor.isStaff && shipment.order?.userSuperTokensId !== actor.userId) {
      throw new NotFoundError("La orden no tiene envío");
    }
    if (!actor.isStaff) delete shipment.order;
    return shipment;
  }

  /** Seguimiento público por código: sin datos personales. */
  async track(code: string) {
    const trackingCode = String(code ?? "").trim().toUpperCase();
    if (!trackingCode) throw new NotFoundError("Envío no encontrado");
    const s: any = await this.shipmentRepository.findByTrackingCode(trackingCode);
    if (!s) throw new NotFoundError("Envío no encontrado");
    return {
      trackingCode: s.trackingCode,
      orderId: s.orderId,
      method: s.method,
      status: s.status,
      carrier: s.carrier,
      carrierTrackingCode: s.carrierTrackingCode,
      carrierTrackingUrl: s.carrierTrackingUrl,
      city: s.city,
      estimatedDeliveryAt: s.estimatedDeliveryAt,
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      createdAt: s.createdAt,
      events: s.events,
    };
  }

  private cleanText(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, 500) : null;
  }

  /** Valida y normaliza los campos editables (whitelist). */
  private parseFields(data: UpdateShipmentDto | undefined, isCreate: boolean) {
    const out: Record<string, any> = {};
    const src: any = data ?? {};

    if (src.method !== undefined || isCreate) {
      const method = String(src.method ?? "DELIVERY").toUpperCase();
      if (!SHIPMENT_METHODS.includes(method as ShipmentMethod)) {
        throw new ValidationError(`method debe ser uno de ${SHIPMENT_METHODS.join(", ")}`);
      }
      out.method = method;
    }
    for (const key of TEXT_FIELDS) {
      if (key in src) out[key] = this.cleanText(src[key]);
    }
    if (out.carrierTrackingUrl && !/^https?:\/\//i.test(out.carrierTrackingUrl)) {
      throw new ValidationError("carrierTrackingUrl debe empezar con http:// o https://");
    }
    if (src.cost !== undefined && src.cost !== null && src.cost !== "") {
      const cost = Number(src.cost);
      if (!Number.isFinite(cost) || cost < 0) throw new ValidationError("cost debe ser un número >= 0");
      out.cost = Math.round(cost * 100) / 100;
    }
    if ("estimatedDeliveryAt" in src) {
      if (!src.estimatedDeliveryAt) {
        out.estimatedDeliveryAt = null;
      } else {
        const date = new Date(src.estimatedDeliveryAt);
        if (Number.isNaN(date.getTime())) throw new ValidationError("estimatedDeliveryAt inválido");
        out.estimatedDeliveryAt = date;
      }
    }
    return out;
  }
}
