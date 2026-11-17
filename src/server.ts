// Debe ser el primer import: carga .env antes de evaluar el resto de los módulos
import "dotenv/config";
import app from "./app.js";
import { errInfo, getLogger, logger } from "./config/logger.js";
import { prisma } from "./config/prisma/client.js";
import { isMercadoPagoConfigured, mpConfig } from "./config/mercadopago.js";
import { isUberConfigured } from "./config/uber.js";
import { PaymentService } from "./services/payment.service.js";
import { ShippingService } from "./services/shipping.service.js";
import { UserService } from "./services/user.service.js";
import { CartService } from "./services/cart.service.js";

const log = getLogger("server");
const PORT = process.env.PORT || 8080;

// Errores que se escaparon: que queden registrados con su stack
process.on("unhandledRejection", (reason: any) => {
  logger.error({ module: "process", err: reason }, "Promesa rechazada sin manejar");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ module: "process", err }, "Excepción no capturada: se reinicia el proceso");
  logger.flush?.();
  setTimeout(() => process.exit(1), 200).unref();
});

const server = app.listen(PORT, () => {
  const mp = mpConfig();
  if (isMercadoPagoConfigured() && mp.requireWebhookSignature && !mp.webhookSecret) {
    log.error("Falta MP_WEBHOOK_SECRET: los webhooks de Mercado Pago se van a rechazar (los pagos se actualizan solo con /sync)");
  }
  log.info(
    {
      port: Number(PORT),
      node: process.version,
      mercadoPago: isMercadoPagoConfigured()
        ? {
            // TEST-... = credenciales de prueba; APP_USR-... = productivas (o de un usuario de prueba)
            credentials: mp.accessToken.startsWith("TEST-") ? "TEST" : "APP_USR",
            webhookSignature: !!mp.webhookSecret,
            notificationUrl: mp.apiPublicUrl.startsWith("https://"),
          }
        : "disabled",
      uber: isUberConfigured(),
      smtp: !!process.env.SMTP_HOST,
    },
    `Servidor escuchando en el puerto ${PORT}`,
  );
});

/** Corre una tarea periódica dejando registro de duración y fallas. */
const job = (name: string, fn: () => Promise<unknown>) => async () => {
  const jobLog = getLogger(`job:${name}`);
  const start = Date.now();
  try {
    const result = await fn();
    jobLog.debug({ result, ms: Date.now() - start }, `Tarea ${name} terminada`);
  } catch (err: any) {
    jobLog.error({ ...errInfo(err), ms: Date.now() - start }, `Tarea ${name} falló`);
  }
};

// Roles del dashboard (RBAC): crea los que falten en SuperTokens y alinea User.role
new UserService().ensureRoles().catch((err) => log.warn(errInfo(err), "No se pudieron sincronizar los roles"));

// Cada 30 min: cancela pedidos de Mercado Pago que no se pagaron a tiempo (libera stock)
const payments = new PaymentService();
const expireUnpaid = job("expire-unpaid-orders", () => payments.expireUnpaidOrders());
const expireTimer = setInterval(expireUnpaid, 30 * 60 * 1000);
setTimeout(expireUnpaid, 60 * 1000);

// Cada 5 min: estado de los repartidores de Uber en curso (sin efecto si Uber no está configurado)
const shipping = new ShippingService();
const shippingTimer = setInterval(job("shipping-sync", () => shipping.syncActive()), 5 * 60 * 1000);

// Cada 6 h: borra carritos de invitado abandonados (vacíos > 7 días, con productos > 30 días)
const carts = new CartService();
const cleanCarts = job("cart-cleanup", async () => {
  const n = await carts.deleteStaleGuestCarts();
  if (n) getLogger("cart").info({ deleted: n }, `${n} carritos de invitado abandonados eliminados`);
  return n;
});
// Solo en producción (o con CART_CLEANUP=on): en desarrollo no se borran datos.
const cartCleanupOn = process.env.CART_CLEANUP ? process.env.CART_CLEANUP === "on" : process.env.NODE_ENV === "production";
const cartTimer = cartCleanupOn ? setInterval(cleanCarts, 6 * 60 * 60 * 1000) : undefined;
if (cartCleanupOn) setTimeout(cleanCarts, 5 * 60 * 1000);

const shutdown = (signal: string) => {
  log.info(`${signal} recibido, cerrando...`);
  clearInterval(expireTimer);
  clearInterval(shippingTimer);
  clearInterval(cartTimer);
  server.close(async () => {
    await prisma.$disconnect();
    logger.flush?.();
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
