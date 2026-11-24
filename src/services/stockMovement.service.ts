import { GenericServiceImpl } from "./generic-impl.service.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { StockMovementRepository, type MovementType } from "../repository/stockMovement.repository.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";

const MANUAL_TYPES: MovementType[] = ["IN", "OUT", "ADJUSTMENT", "RETURN"];
const MAX_BULK = 200;
const MAX_BACKDATE_DAYS = 366;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

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

  private parseManual(data: CreateMovementDto, row?: number) {
    const prefix = row ? `Fila ${row}: ` : "";
    const variantId = Number(data?.productVariantId);
    const quantity = Number(data?.quantity);
    const type = String(data?.type ?? "").toUpperCase() as MovementType;

    if (!Number.isInteger(variantId) || variantId <= 0) {
      throw new ValidationError(`${prefix}elegí una variante`);
    }
    if (!Number.isInteger(quantity) || quantity === 0) {
      throw new ValidationError(`${prefix}la cantidad debe ser un entero distinto de 0`);
    }
    if (!MANUAL_TYPES.includes(type)) {
      throw new ValidationError(`${prefix}el tipo debe ser uno de ${MANUAL_TYPES.join(", ")}`);
    }
    if ((type === "IN" || type === "RETURN") && quantity < 0) {
      throw new BadRequestError(`${prefix}un movimiento ${type} debe tener cantidad positiva`);
    }
    if (type === "OUT" && quantity > 0) {
      throw new BadRequestError(`${prefix}un movimiento OUT debe tener cantidad negativa`);
    }

    let createdAt: Date | null = null;
    if (data?.createdAt !== undefined && data.createdAt !== null && data.createdAt !== "") {
      createdAt = new Date(data.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new ValidationError(`${prefix}la fecha no es válida`);
      const now = Date.now();
      if (createdAt.getTime() > now + FUTURE_TOLERANCE_MS) {
        throw new ValidationError(`${prefix}la fecha no puede ser futura`);
      }
      if (createdAt.getTime() < now - MAX_BACKDATE_DAYS * 86_400_000) {
        throw new ValidationError(`${prefix}la fecha no puede tener más de un año`);
      }
    }
    return { variantId, quantity, type, createdAt };
  }

  async create(data: CreateMovementDto): Promise<MovementDto & { currentStock: number }> {
    const movement = this.parseManual(data);
    return this.stockRepository.withTransaction(async (tx) => {
      await this.stockRepository.lockVariants([movement.variantId], tx);
      const currentStock = await this.stockRepository.createStockMovement(
        movement.variantId,
        movement.quantity,
        movement.type,
        tx,
        movement.createdAt,
      );
      const createdMovement = await this.stockRepository.latestMovementForVariant(movement.variantId, tx);
      if (!createdMovement) {
        throw new Error("No se pudo recuperar el movimiento de stock recién registrado");
      }
      return { ...createdMovement, currentStock };
    });
  }

  /** Todos los movimientos o ninguno; filas repetidas de una variante se aplican en orden. */
  async createBulk(data: CreateMovementDto[]): Promise<{ count: number; movements: any[] }> {
    if (!Array.isArray(data) || data.length === 0) throw new ValidationError("No hay movimientos para registrar");
    if (data.length > MAX_BULK) throw new ValidationError(`Máximo ${MAX_BULK} movimientos por carga`);
    const parsed = data.map((movement, index) => this.parseManual(movement, index + 1));

    return this.stockRepository.withTransaction(async (tx) => {
      await this.stockRepository.lockVariants(parsed.map(({ variantId }) => variantId), tx);
      const results: any[] = [];
      for (const [index, movement] of parsed.entries()) {
        try {
          const currentStock = await this.stockRepository.createStockMovement(
            movement.variantId,
            movement.quantity,
            movement.type,
            tx,
            movement.createdAt,
          );
          results.push({
            productVariantId: movement.variantId,
            quantity: movement.quantity,
            type: movement.type,
            createdAt: movement.createdAt ?? new Date(),
            currentStock,
          });
        } catch (error: any) {
          const prefix = `Fila ${index + 1}: `;
          if (error instanceof StoreProcedureError && error.businessMessage) {
            throw new StoreProcedureError("create_stock_movement", {
              code: "P0001",
              message: `ERROR: ${prefix}${error.businessMessage}`,
            });
          }
          const message = error?.message ?? "no se pudo registrar";
          throw new BadRequestError(prefix + message);
        }
      }
      return { count: results.length, movements: results };
    });
  }

  createStockMovement(
    variantId: number,
    delta: number,
    type: MovementType | string,
    tx?: any,
    createdAt?: Date | null,
  ) {
    return this.stockRepository.createStockMovement(variantId, delta, type, tx, createdAt);
  }

  setStockLevel(variantId: number, target: number, tx?: any) {
    return this.stockRepository.setStockLevel(variantId, target, tx);
  }

  processMixProduction(mixVariantId: number, amount: number, tx?: any) {
    return this.stockRepository.processMixProduction(mixVariantId, amount, tx);
  }

}
