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
    return await this.stockMovementRepository.createStockMovement(
      mixVariantId,
      newStock,
      type,
      tx
    );
  }
}
