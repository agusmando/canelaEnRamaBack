// Debe ser el primer import: carga .env antes de evaluar el resto de los módulos
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma/client.js";
import { PaymentService } from "./services/payment.service.js";
import { ShippingService } from "./services/shipping.service.js";
import { UserService } from "./services/user.service.js";

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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

const shutdown = (signal: string) => {
  console.log(`${signal} recibido, cerrando...`);
  clearInterval(expireTimer);
  clearInterval(shippingTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
