import { PrismaClient } from "@prisma/client";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";
export class StockMovementRepository {
  prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async createStockMovement(
    mixVariantId: number,
    newStock: number,
    type: string,
    tx?: PrismaClient,
  ) {
    const model = tx ?? this.prisma;
    await model.$executeRaw`SELECT public.create_stock_movement(${mixVariantId}::INT, ${newStock}::INT, ${type}::TEXT)`;
  }

  async processMixProduction(
    mixVariantId: number,
    amount: number,
    tx?: PrismaClient,
  ) {
    const model = tx ?? this.prisma;
    await model.$executeRaw`SELECT public.process_mix_production(${mixVariantId}::INT, ${amount}::INT)`;
  }
}
