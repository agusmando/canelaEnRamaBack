import { GenericRepositoryImpl } from "./generic.repository.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

export type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "RETURN" | "PRODUCTION";

/**
 * Único punto de acceso a las funciones SQL de stock y precios.
 * Todas devuelven errores de negocio (RAISE EXCEPTION) como StoreProcedureError
 * con `businessMessage`, que la API responde como 409.
 */
export class StockMovementRepository extends GenericRepositoryImpl<
  MovementDto,
  CreateMovementDto,
  CreateMovementDto
> {
  constructor() {
    super("stockMovement", { orderBy: { id: "desc" } });
  }

  private async callSp<R = unknown>(name: string, run: (db: any) => Promise<R>, tx?: any) {
    try {
      return await run(tx ?? this.prisma);
    } catch (error) {
      const translated = translatePrismaError(error, name);
      throw translated instanceof StoreProcedureError
        ? translated
        : new StoreProcedureError(name, error);
    }
  }

  /**
   * Bloquea las filas de las variantes hasta el fin de la transacción (en orden
   * de id para evitar deadlocks). Usar antes de leer stock para decidir algo.
   */
  async lockVariants(variantIds: number[], tx: any) {
    const ids = [...new Set(variantIds.map(Number))].filter(Number.isInteger);
    if (!ids.length) return;
    await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ANY(${ids}::int[]) ORDER BY id FOR UPDATE`;
  }

  /** Aplica un delta de stock (+ entra, - sale). Devuelve el stock final. */
  async createStockMovement(
    variantId: number,
    delta: number,
    type: MovementType | string,
    tx?: any,
  ): Promise<number> {
    const rows = await this.callSp<{ stock: number }[]>(
      "create_stock_movement",
      (db) =>
        db.$queryRaw`SELECT public.create_stock_movement(${Number(variantId)}::INT, ${Math.round(Number(delta))}::INT, ${type}::TEXT) AS stock`,
      tx,
    );
    return Number(rows?.[0]?.stock);
  }

  /** Fija el stock a un valor absoluto (registra ADJUSTMENT por la diferencia). */
  async setStockLevel(variantId: number, target: number, tx?: any): Promise<number> {
    const rows = await this.callSp<{ stock: number }[]>(
      "set_stock_level",
      (db) =>
        db.$queryRaw`SELECT public.set_stock_level(${Number(variantId)}::INT, ${Math.round(Number(target))}::INT) AS stock`,
      tx,
    );
    return Number(rows?.[0]?.stock);
  }

  /** Produce `amount` de un mix consumiendo sus componentes. */
  async processMixProduction(mixVariantId: number, amount: number, tx?: any) {
    await this.callSp(
      "process_mix_production",
      (db) =>
        db.$executeRaw`SELECT public.process_mix_production(${Number(mixVariantId)}::INT, ${Math.round(Number(amount))}::INT)`,
      tx,
    );
  }

  async recalculateMixPrice(mixVariantId: number, tx?: any) {
    await this.callSp(
      "recalculate_mix_price",
      (db) => db.$executeRaw`SELECT public.recalculate_mix_price(${Number(mixVariantId)}::INT)`,
      tx,
    );
  }

  /** Recalcula todos los mixes (en cascada) que usan esta variante como componente. */
  async recalculateMixesUsingComponent(componentVariantId: number, tx?: any) {
    await this.callSp(
      "recalculate_all_mixes_from_product",
      (db) =>
        db.$executeRaw`SELECT public.recalculate_all_mixes_from_product(${Number(componentVariantId)}::INT)`,
      tx,
    );
  }

  async addComponentToVariant(
    componentVariantId: number,
    mixVariantId: number,
    quantity: number,
    tx?: any,
  ) {
    await this.callSp(
      "add_component_to_variant",
      (db) =>
        db.$executeRaw`SELECT public.add_component_to_variant(${Number(componentVariantId)}::INT, ${Number(mixVariantId)}::INT, ${Number(quantity)}::FLOAT8)`,
      tx,
    );
  }
}
