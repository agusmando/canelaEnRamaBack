import { GenericServiceImpl } from "./generic-impl.service.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { StockMovementRepository, type MovementType } from "../repository/stockMovement.repository.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";

const MANUAL_TYPES: MovementType[] = ["IN", "OUT", "ADJUSTMENT", "RETURN"];

export class StockMovementService extends GenericServiceImpl<
  MovementDto,
  CreateMovementDto,
  CreateMovementDto
> {
  readonly stockRepository: StockMovementRepository;

  constructor(stockRepository = new StockMovementRepository()) {
    super(stockRepository);
    this.stockRepository = stockRepository;
  }

  /**
   * Movimiento manual de stock (POST /movement). Antes insertaba la fila sin
   * actualizar `currentStock`; ahora pasa por la función SQL.
   */
  async create(data: CreateMovementDto): Promise<any> {
    const movement = this.normalize(data);
    const currentStock = await this.stockRepository.createStockMovement(
      movement.productVariantId,
      movement.quantity,
      movement.type,
      undefined,
      movement.createdAt,
    );
    return { ...movement, currentStock };
  }

  async createBulk(data: CreateMovementDto[]): Promise<{ count: number }> {
    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError("Se requiere al menos un movimiento");
    }

    return this.stockRepository.withTransaction(async (tx) => {
      await this.stockRepository.lockVariants(
        data.map((movement) => Number(movement?.productVariantId)),
        tx,
      );
      for (const [index, rawMovement] of data.entries()) {
        let movement: ReturnType<StockMovementService["normalize"]>;
        try {
          movement = this.normalize(rawMovement);
        } catch (error) {
          throw this.withRowNumber(error, index + 1);
        }

        try {
          await this.stockRepository.createStockMovement(
            movement.productVariantId,
            movement.quantity,
            movement.type,
            tx,
            movement.createdAt,
          );
        } catch (error) {
          throw this.withRowNumber(error, index + 1);
        }
      }
      return { count: data.length };
    });
  }

  createStockMovement(
    variantId: number,
    delta: number,
    type: MovementType | string,
    tx?: any,
    createdAt?: Date,
  ) {
    return this.stockRepository.createStockMovement(variantId, delta, type, tx, createdAt);
  }

  setStockLevel(variantId: number, target: number, tx?: any) {
    return this.stockRepository.setStockLevel(variantId, target, tx);
  }

  processMixProduction(mixVariantId: number, amount: number, tx?: any) {
    return this.stockRepository.processMixProduction(mixVariantId, amount, tx);
  }

  private normalize(data: CreateMovementDto) {
    const variantId = Number(data?.productVariantId);
    const quantity = Number(data?.quantity);
    const type = String(data?.type ?? "").toUpperCase() as MovementType;

    if (!Number.isInteger(variantId) || variantId <= 0) {
      throw new ValidationError("productVariantId es requerido");
    }
    if (!Number.isInteger(quantity) || quantity === 0) {
      throw new ValidationError("quantity debe ser un entero distinto de 0");
    }
    if (!MANUAL_TYPES.includes(type)) {
      throw new ValidationError(`type debe ser uno de ${MANUAL_TYPES.join(", ")}`);
    }
    if ((type === "IN" || type === "RETURN") && quantity < 0) {
      throw new BadRequestError(`Un movimiento ${type} debe tener quantity positiva`);
    }
    if (type === "OUT" && quantity > 0) {
      throw new BadRequestError("Un movimiento OUT debe tener quantity negativa");
    }

    let createdAt: Date | undefined;
    if (data.createdAt !== undefined) {
      createdAt = new Date(data.createdAt);
      if (!Number.isFinite(createdAt.getTime())) {
        throw new ValidationError("createdAt debe ser una fecha ISO válida");
      }
    }

    return { productVariantId: variantId, quantity, type, createdAt };
  }

  private withRowNumber(error: unknown, row: number): Error {
    const prefix = `Fila ${row}: `;
    if (error instanceof StoreProcedureError && error.businessMessage) {
      return new StoreProcedureError("create_stock_movement", {
        code: "P0001",
        message: `ERROR: ${prefix}${error.businessMessage}`,
      });
    }
    if (error instanceof ValidationError) {
      return new ValidationError(prefix + error.message);
    }
    if (error instanceof BadRequestError) {
      return new BadRequestError(prefix + error.message);
    }
    return error instanceof Error ? new Error(prefix + error.message) : new Error(prefix + String(error));
  }
}
