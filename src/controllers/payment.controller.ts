import { PaymentService } from "../services/payment.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { parseId } from "./generic-impl.controller.js";
import { getActor } from "../middleware/auth.middleware.js";
import { verifyWebhookSignature } from "../config/mercadopago.js";
import { errInfo, getLogger } from "../config/logger.js";

const log = getLogger("payment");

const SIGNATURE_HINT: Record<string, string> = {
  missing_header: "sin header x-signature",
  malformed: "x-signature mal formado",
  invalid: "firma inválida: ¿MP_WEBHOOK_SECRET es el de esta aplicación y ambiente?",
  expired: "firma vencida: ver MP_WEBHOOK_TOLERANCE_MINUTES",
};

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

    const ctx = {
      type,
      action: body.action,
      dataId: dataId ? String(dataId) : undefined,
      liveMode: body.live_mode,
      mpRequestId: req.get("x-request-id"),
      hasSignature: !!req.get("x-signature"),
    };

    const signature = verifyWebhookSignature(req.get("x-signature"), req.get("x-request-id"), ctx.dataId);
    const logCtx = { ...ctx, signature: signature.reason, signatureAgeSeconds: signature.ageSeconds };
    if (!signature.ok) {
      if (signature.reason === "missing_secret") {
        log.error(logCtx, "Webhook rechazado: falta MP_WEBHOOK_SECRET (obligatorio en producción)");
      } else {
        log.warn(logCtx, `Webhook de Mercado Pago rechazado (${SIGNATURE_HINT[signature.reason]})`);
      }
      return res.status(401).json(new BaseResponse(401, "Invalid signature", {}));
    }
    log.info(logCtx, `Webhook de Mercado Pago recibido: ${type ?? "sin tipo"} ${ctx.dataId ?? ""}`);
    try {
      const handled = await this.service.handleNotification(type, ctx.dataId);
      if (!handled) log.debug(ctx, "Webhook ignorado (no es un pago o Mercado Pago no está configurado)");
      res.status(200).json(new BaseResponse(200, "OK", {}));
    } catch (error: any) {
      log.error({ ...ctx, ...errInfo(error) }, "Error procesando webhook: Mercado Pago lo va a reintentar");
      res.status(500).json(new BaseResponse(500, "Webhook processing failed", {}));
    }
  }
}
