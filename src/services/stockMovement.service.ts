import { GenericServiceImpl } from "./generic-impl.service.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { StockMovementRepository, type MovementType } from "../repository/stockMovement.repository.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";

const MANUAL_TYPES: MovementType[] = ["IN", "OUT", "ADJUSTMENT", "RETURN"];
const MAX_BULK = 200;

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

  /** Valida un movimiento manual y normaliza tipo/cantidad. `row` agrega "Fila N:" a los errores. */
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
    // Coherencia de signo para evitar errores de carga
    if ((type === "IN" || type === "RETURN") && quantity < 0) {
      throw new BadRequestError(`${prefix}un movimiento ${type} debe tener cantidad positiva`);
    }
    if (type === "OUT" && quantity > 0) {
      throw new BadRequestError(`${prefix}un movimiento OUT debe tener cantidad negativa`);
    }
    return { variantId, quantity, type };
  }

  /**
   * Movimiento manual de stock (POST /movement). Antes insertaba la fila sin
   * actualizar `currentStock`; ahora pasa por la función SQL.
   */
  async create(data: CreateMovementDto): Promise<any> {
    const { variantId, quantity, type } = this.parseManual(data);
    const currentStock = await this.stockRepository.createStockMovement(variantId, quantity, type);
    return { productVariantId: variantId, quantity, type, currentStock };
  }

  /**
   * Carga masiva (POST /movement/bulk): todos los movimientos o ninguno.
   * Se aplican en orden, así varias filas de la misma variante se acumulan.
   */
  async createBulk(rows: CreateMovementDto[]): Promise<any> {
    if (!Array.isArray(rows) || rows.length === 0) throw new ValidationError("No hay movimientos para registrar");
    if (rows.length > MAX_BULK) throw new ValidationError(`Máximo ${MAX_BULK} movimientos por carga`);
    const parsed = rows.map((r, i) => this.parseManual(r, i + 1));

    return this.stockRepository.withTransaction(async (tx) => {
      const results = [];
      for (const [i, m] of parsed.entries()) {
        try {
          const currentStock = await this.stockRepository.createStockMovement(m.variantId, m.quantity, m.type, tx);
          results.push({ productVariantId: m.variantId, quantity: m.quantity, type: m.type, currentStock });
        } catch (error: any) {
          // El mensaje de la función SQL (p. ej. stock insuficiente) con el número de fila
          throw new BadRequestError(`Fila ${i + 1}: ${error?.businessMessage ?? error?.message ?? "no se pudo registrar"}`);
        }
      }
      return { count: results.length, movements: results };
    });
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
