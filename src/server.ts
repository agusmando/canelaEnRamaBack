// Debe ser el primer import: carga .env antes de evaluar el resto de los módulos
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma/client.js";
import { PaymentService } from "./services/payment.service.js";

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Cada 30 min: cancela pedidos de Mercado Pago que no se pagaron a tiempo (libera stock)
const payments = new PaymentService();
const expireUnpaid = () =>
  payments.expireUnpaidOrders().catch((err) => console.warn("[payment] vencimiento falló:", err.message));
const expireTimer = setInterval(expireUnpaid, 30 * 60 * 1000);
setTimeout(expireUnpaid, 60 * 1000);

const shutdown = (signal: string) => {
  console.log(`${signal} recibido, cerrando...`);
  clearInterval(expireTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
