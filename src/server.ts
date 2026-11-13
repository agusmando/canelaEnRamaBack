// Debe ser el primer import: carga .env antes de evaluar el resto de los módulos
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma/client.js";

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} recibido, cerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
