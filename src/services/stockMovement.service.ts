import { GenericServiceImpl } from "./generic-impl.service.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { StockMovementRepository, type MovementType } from "../repository/stockMovement.repository.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";

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
    const variantId = Number(data?.productVariantId);
    const quantity = Number(data?.quantity);
    const type = String(data?.type ?? "").toUpperCase() as MovementType;

    if (!Number.isInteger(variantId) || variantId <= 0) {
      throw new ValidationError("productVariantId es requerido");
    }
    if (!Number.isFinite(quantity) || quantity === 0) {
      throw new ValidationError("quantity debe ser un número distinto de 0");
    }
    if (!MANUAL_TYPES.includes(type)) {
      throw new ValidationError(`type debe ser uno de ${MANUAL_TYPES.join(", ")}`);
    }
    // Coherencia de signo para evitar errores de carga
    if ((type === "IN" || type === "RETURN") && quantity < 0) {
      throw new BadRequestError(`Un movimiento ${type} debe tener quantity positiva`);
    }
    if (type === "OUT" && quantity > 0) {
      throw new BadRequestError("Un movimiento OUT debe tener quantity negativa");
    }

    const currentStock = await this.stockRepository.createStockMovement(variantId, quantity, type);
    return { productVariantId: variantId, quantity, type, currentStock };
  }

  createStockMovement(variantId: number, delta: number, type: MovementType | string, tx?: any) {
    return this.stockRepository.createStockMovement(variantId, delta, type, tx);
  }

  setStockLevel(variantId: number, target: number, tx?: any) {
    return this.stockRepository.setStockLevel(variantId, target, tx);
  }

  processMixProduction(mixVariantId: number, amount: number, tx?: any) {
    return this.stockRepository.processMixProduction(mixVariantId, amount, tx);
  }
}
