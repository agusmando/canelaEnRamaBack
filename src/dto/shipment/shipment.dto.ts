export const SHIPMENT_METHODS = ["DELIVERY", "PICKUP"] as const;
export type ShipmentMethod = (typeof SHIPMENT_METHODS)[number];

export const SHIPMENT_STATUSES = [
  "PENDING",
  "PREPARING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "FAILED_ATTEMPT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export class ShipmentEventDto {
  id!: number;
  shipmentId!: number;
  status!: ShipmentStatus;
  description!: string | null;
  location!: string | null;
  createdAt!: Date;
}

export class ShipmentDto {
  id!: number;
  orderId!: number;
  trackingCode!: string;
  method!: ShipmentMethod;
  status!: ShipmentStatus;
  carrier!: string | null;
  carrierTrackingCode!: string | null;
  carrierTrackingUrl!: string | null;
  recipientName!: string | null;
  phone!: string | null;
  address!: string | null;
  city!: string | null;
  province!: string | null;
  postalCode!: string | null;
  notes!: string | null;
  cost!: number;
  estimatedDeliveryAt!: Date | null;
  shippedAt!: Date | null;
  deliveredAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  events!: ShipmentEventDto[];
}

/** Campos editables por el staff (el estado se cambia con un evento). */
export class UpdateShipmentDto {
  method?: ShipmentMethod;
  carrier?: string | null;
  carrierTrackingCode?: string | null;
  carrierTrackingUrl?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  cost?: number;
  estimatedDeliveryAt?: string | Date | null;
}

export class CreateShipmentDto extends UpdateShipmentDto {
  orderId!: number;
}

export class CreateShipmentEventDto {
  status!: ShipmentStatus;
  description?: string | null;
  location?: string | null;
}
