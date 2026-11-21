import { PaymentService } from "../services/payment.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { parseId } from "./generic-impl.controller.js";
import { getActor } from "../middleware/auth.middleware.js";
import { verifyWebhookSignature } from "../config/mercadopago.js";

export class PaymentController {
  constructor(private readonly service = new PaymentService()) {}

  /** GET /payment/config — qué medios online están habilitados (público). */
  config(_req: any, res: any) {
    res.status(200).json(new BaseResponse(200, "Payment config", this.service.publicConfig()));
  }

  /** POST /payment/order/:id/preference — link de pago de Mercado Pago para la orden. */
  async createPreference(req: any, res: any, next: any) {
    try {
      const result = await this.service.createPreference(parseId(req.params.id), getActor(req));
      res.status(201).json(new BaseResponse(201, "Payment preference created", result));
    } catch (error) {
      next(error);
    }
  }

  /** POST /payment/order/:id/sync — re-consulta el pago en Mercado Pago y devuelve la orden. */
  async sync(req: any, res: any, next: any) {
    try {
      const order = await this.service.syncOrder(parseId(req.params.id), getActor(req));
      res.status(200).json(new BaseResponse(200, "Payment synced", order));
    } catch (error) {
      next(error);
    }
  }

  /** POST /payment/order/:id/refund — reintegra el total y cancela la orden. */
  async refundFullOrder(req: any, res: any, next: any) {
    try {
      const result = await this.service.refundFullOrder(
        parseId(req.params.id),
        req.body?.note,
        getActor(req),
      );
      res.status(200).json(new BaseResponse(200, "Full order refund processed", result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /payment/webhook — notificaciones de Mercado Pago.
   * Formato Webhooks: ?data.id=123&type=payment (+ body { type, data: { id } }).
   * Formato IPN viejo: ?topic=payment&id=123.
   * Responde 2xx rápido; si falla el procesamiento devuelve 500 para que Mercado Pago reintente.
   */
  async webhook(req: any, res: any) {
    const q = req.query ?? {};
    const body = req.body ?? {};
    const type: string | undefined = q.type ?? q.topic ?? body.type ?? body.topic;
    const dataId: string | undefined = q["data.id"] ?? body?.data?.id ?? q.id;

    if (!verifyWebhookSignature(req.get("x-signature"), req.get("x-request-id"), dataId ? String(dataId) : undefined)) {
      console.warn("[payment] webhook con firma inválida; se ignora");
      return res.status(401).json(new BaseResponse(401, "Invalid signature", {}));
    }
    try {
      await this.service.handleNotification(type, dataId ? String(dataId) : undefined);
      res.status(200).json(new BaseResponse(200, "OK", {}));
    } catch (error: any) {
      console.error("[payment] error procesando webhook:", error?.message ?? error);
      res.status(500).json(new BaseResponse(500, "Webhook processing failed", {}));
    }
  }
}
