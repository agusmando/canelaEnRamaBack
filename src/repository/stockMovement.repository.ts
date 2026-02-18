import { PrismaClient } from "@prisma/client";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.ts";
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
    try {
      const model = tx ?? this.prisma;
      await model.$executeRaw`SELECT public.create_stock_movement(${mixVariantId}::INT, ${newStock}::INT, ${type}::TEXT)`;
    } catch (error) {
      throw new StoreProcedureError("create_stock_movement" + error);
    }
  }

  async processMixProduction(
    mixVariantId: number,
    amount: number,
    tx?: PrismaClient,
  ) {
    try {
      const model = tx ?? this.prisma;
      await model.$executeRaw`SELECT public.process_mix_production(${mixVariantId}::INT, ${amount}::INT)`;
    } catch (error) {
      throw new StoreProcedureError("process_mix_production");
    }
  }
}
