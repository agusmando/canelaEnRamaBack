import { Prisma, PrismaClient } from "@prisma/client";

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

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: logLevels });

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
