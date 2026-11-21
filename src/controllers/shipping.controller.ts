import { ShippingQuoteService, pickupInfo } from "../services/shipping-quote.service.js";
import { ShippingService } from "../services/shipping.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";
import { parseId } from "./generic-impl.controller.js";

type Handler = (req: any) => Promise<{ status?: number; message: string; data: unknown }>;

/** Envuelve un handler: responde con BaseResponse y manda los errores al errorHandler. */
const handle = (fn: Handler) => async (req: any, res: any, next: any) => {
  try {
    const { status = 200, message, data } = await fn(req);
    // `null` se respeta (p. ej. "sin domicilio"); solo `undefined` pasa a {}
    res.status(status).json(new BaseResponse(status, message, (data === undefined ? {} : data) as any));
  } catch (error) {
    next(error);
  }
};

export class ShippingController {
  constructor(
    private readonly quotes = new ShippingQuoteService(),
    private readonly shipping = new ShippingService(),
  ) {}

  /** GET /shipping/config — público: departamentos, tarifas activas y proveedores. */
  config = handle(async () => ({
    message: "Shipping config",
    data: {
      zones: await this.quotes.publicZones(),
      departments: await this.quotes.zoneNames(),
      providers: this.shipping.providers(),
      pickup: { name: pickupInfo().name, address: `${pickupInfo().address.street}, ${pickupInfo().address.city}` },
      methods: ["DELIVERY", "PICKUP"],
      deliveryEnabled: true,
      pickupEnabled: true,
      carrierTrackingSupported: true,
    },
  }));

  getAddress = handle(async (req) => ({
    message: "Address",
    data: (await this.quotes.getAddress(getActor(req).userId!)) ?? null,
  }));

  saveAddress = handle(async (req) => ({
    message: "Address saved",
    data: await this.quotes.saveAddress(getActor(req).userId!, req.body ?? {}),
  }));

  /** GET /shipping/quote — cotiza el envío al domicilio guardado del usuario. */
  quote = handle(async (req) => {
    const value = Number(req.query.value);
    return {
      message: "Shipping quote",
      data: await this.quotes.quoteForUser(getActor(req).userId!, Number.isFinite(value) && value > 0 ? value : undefined),
    };
  });

  listZones = handle(async () => ({ message: "Zones", data: await this.quotes.listZones() }));
  createZone = handle(async (req) => ({ status: 201, message: "Zone created", data: await this.quotes.createZone(req.body) }));
  updateZone = handle(async (req) => ({ message: "Zone updated", data: await this.quotes.updateZone(parseId(req.params.id), req.body) }));

  dispatch = handle(async (req) => ({ message: "Courier requested", data: await this.shipping.dispatch(parseId(req.params.id)) }));
  sync = handle(async (req) => ({ message: "Shipment synced", data: await this.shipping.sync(parseId(req.params.id)) }));
  cancel = handle(async (req) => ({ message: "Courier cancelled", data: await this.shipping.cancel(parseId(req.params.id)) }));
}
