// Debe ser el primer import: carga .env antes de evaluar el resto de los módulos
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma/client.js";
import { PaymentService } from "./services/payment.service.js";
import { ShippingService } from "./services/shipping.service.js";
import { UserService } from "./services/user.service.js";
import { CartService } from "./services/cart.service.js";
import { checkSmtp } from "./config/mailer.js";

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Deja en el log si el SMTP conecta y acepta el login
checkSmtp();

// Roles del dashboard (RBAC): crea los que falten en SuperTokens y alinea User.role
new UserService().ensureRoles().catch((err) => console.warn("[users] no se pudieron sincronizar los roles:", err.message));

// Cada 30 min: cancela pedidos de Mercado Pago que no se pagaron a tiempo (libera stock)
const payments = new PaymentService();
const expireUnpaid = () =>
  payments.expireUnpaidOrders().catch((err) => console.warn("[payment] vencimiento falló:", err.message));
const expireTimer = setInterval(expireUnpaid, 30 * 60 * 1000);
setTimeout(expireUnpaid, 60 * 1000);

// Cada 5 min: estado de los repartidores de Uber en curso (sin efecto si Uber no está configurado)
const shipping = new ShippingService();
const shippingTimer = setInterval(
  () => shipping.syncActive().catch((err) => console.warn("[shipping] sincronización falló:", err.message)),
  5 * 60 * 1000,
);

// Cada 6 h: borra carritos de invitado abandonados (vacíos > 7 días, con productos > 30 días)
const carts = new CartService();
const cleanCarts = () =>
  carts
    .deleteStaleGuestCarts()
    .then((n) => n && console.log(`[cart] ${n} carritos de invitado abandonados eliminados`))
    .catch((err) => console.warn("[cart] limpieza falló:", err.message));
// Solo en producción (o con CART_CLEANUP=on): en desarrollo no se borran datos.
const cartCleanupOn = process.env.CART_CLEANUP ? process.env.CART_CLEANUP === "on" : process.env.NODE_ENV === "production";
const cartTimer = cartCleanupOn ? setInterval(cleanCarts, 6 * 60 * 60 * 1000) : undefined;
if (cartCleanupOn) setTimeout(cleanCarts, 5 * 60 * 1000);

const shutdown = (signal: string) => {
  console.log(`${signal} recibido, cerrando...`);
  clearInterval(expireTimer);
  clearInterval(shippingTimer);
  clearInterval(cartTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
