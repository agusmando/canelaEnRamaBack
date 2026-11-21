import { Prisma, PrismaClient } from "@prisma/client";
import { getLogger } from "../logger.js";

/**
 * Único PrismaClient de la aplicación.
 *
 * Antes cada repositorio hacía `new PrismaClient()`, lo que abría un pool de
 * conexiones por instancia (más de 20 pools). Contra el pooler de Supabase eso
 * agota las conexiones en cuanto hay tráfico real.
 *
 * Nivel de log: PRISMA_LOG=query,info,warn,error (por defecto solo warn,error).
 */
const logLevels = (process.env.PRISMA_LOG ?? "warn,error")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean) as Prisma.LogLevel[];

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const createClient = () => {
  // Los logs de Prisma pasan por el logger de la app (JSON en Render, con reqId)
  const client = new PrismaClient({ log: logLevels.map((level) => ({ emit: "event" as const, level })) });
  const log = getLogger("prisma");
  if (logLevels.includes("query")) {
    client.$on("query" as never, (e: Prisma.QueryEvent) => log.debug({ query: e.query, ms: e.duration }, "query"));
  }
  if (logLevels.includes("info")) client.$on("info" as never, (e: Prisma.LogEvent) => log.info({ target: e.target }, e.message));
  if (logLevels.includes("warn")) client.$on("warn" as never, (e: Prisma.LogEvent) => log.warn({ target: e.target }, e.message));
  if (logLevels.includes("error")) client.$on("error" as never, (e: Prisma.LogEvent) => log.error({ target: e.target }, e.message));
  return client;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma; // evita múltiples clientes con tsx watch
}

/** Cliente transaccional o cliente raíz: ambos exponen los mismos delegates. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export const runInTransaction = <R>(
  callback: (tx: Prisma.TransactionClient) => Promise<R>,
  options?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<R> =>
  prisma.$transaction(callback, { timeout: 60000, ...options });
