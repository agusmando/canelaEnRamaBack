import { PrismaClient } from "@prisma/client/extension";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.ts";
import { StockMovementRepository } from "../repository/stockMovement.repository.ts";
export class StockMovementService {
  stockMovementRepository: StockMovementRepository;
  constructor() {
    this.stockMovementRepository = new StockMovementRepository();
  }

  async createStockMovement(
    mixVariantId: number,
    newStock: number,
    type: string,
    tx?: PrismaClient
  ) {
    try {
      return await this.stockMovementRepository.createStockMovement(
        mixVariantId,
        newStock,
        type,
        tx
      );
    } catch (error) {
      throw new StoreProcedureError("create_stock_movement", error);
    }
  }

  async processMixProduction(
    mixVariantId: number,
    amount: number,
    tx?: PrismaClient,
  ) {
    try {
      return await this.stockMovementRepository.processMixProduction(
        mixVariantId,
        amount,
        tx
      );
    } catch (error) {
      throw new StoreProcedureError("process_mix_production", error);
    }
  } 
}
