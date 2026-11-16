import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.js";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.js";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { ProductVariantRepository } from "../repository/product-variant.repository.js";
import { StockMovementRepository } from "../repository/stockMovement.repository.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { ImageService } from "./image.service.js";

type ComponentInput = { productVariantId: number; quantity: number };

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export class ProductVariantService extends GenericServiceImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  readonly productVariantRepository: ProductVariantRepository;
  readonly stockRepository: StockMovementRepository;
  readonly imageService: ImageService;

  constructor(
    productVariantRepository = new ProductVariantRepository(),
    stockRepository = new StockMovementRepository(),
    imageService = new ImageService(),
  ) {
    super(productVariantRepository);
    this.productVariantRepository = productVariantRepository;
    this.stockRepository = stockRepository;
    this.imageService = imageService;
  }

  /**
   * Crea una variante. El stock inicial NO se escribe directo: se crea en 0 y
   * se registra un movimiento IN (o una producción si es un mix).
   */
  async createVariant(
    createData: CreateProductVariantDto,
    uploadedFiles: any[],
  ): Promise<ProductVariantDto> {
    try {
      if (!createData || !toNumber(createData.productId)) {
        throw new ValidationError("productId es requerido");
      }
      if (!createData.name) {
        throw new ValidationError("name es requerido");
      }

      const initialStock = toNumber(createData.currentStock) ?? 0;

      return await this.productVariantRepository.withTransaction(async (tx) => {
        const created: any = await this.productVariantRepository.createVariant(
          { ...createData, currentStock: 0 },
          uploadedFiles,
          tx,
        );
        const isMix = (created.hasComponents?.length ?? 0) > 0;

        if (isMix) {
          await this.stockRepository.recalculateMixPrice(created.id, tx);
        }
        if (initialStock > 0) {
          if (isMix) {
            await this.stockRepository.processMixProduction(created.id, initialStock, tx);
          } else {
            await this.stockRepository.createStockMovement(created.id, initialStock, "IN", tx);
          }
        }
        return this.productVariantRepository.getById(created.id, tx);
      });
    } catch (error) {
      await this.imageService.abortImageUpload(uploadedFiles);
      throw error;
    }
  }

  /**
   * Actualiza una variante.
   *   - currentStock:   valor ABSOLUTO (inventario). Registra ADJUSTMENT por la diferencia.
   *   - stockIncrement: delta. Positivo en un mix = producir (consume componentes).
   *   - price / profitMargin: recalcula en cascada los mixes que usan esta variante.
   *   - add/edit/removeComponents: modifica la receta y recalcula el precio del mix.
   */
  async updateVariant(
    id: number,
    data: UpdateProductVariantDto,
    uploadedFiles: any[],
  ): Promise<ProductVariantDto> {
    let removedPublicIds: string[] = [];
    try {
      if (!id) throw new NotFoundError();
      if (!data) throw new ValidationError("body vacío");

      const result = await this.productVariantRepository.withTransaction(async (tx) => {
        const updated: any = await this.productVariantRepository.updateVariant(
          id,
          data,
          uploadedFiles,
          tx,
        );
        if (!updated) throw new NotFoundError();

        // 1. Receta del mix
        const recipeChanged = await this.applyComponentChanges(id, data, tx);

        // 2. Precio: si cambió el costo/margen o la receta, recalcular mixes que me usan
        const priceChanged =
          data.price !== undefined || data.profitMargin !== undefined || recipeChanged;
        if (priceChanged) {
          await this.stockRepository.recalculateMixesUsingComponent(id, tx);
        }

        // 3. Stock
        const targetStock = toNumber(data.currentStock);
        const increment = toNumber(data.stockIncrement);
        if (targetStock !== undefined && increment !== undefined) {
          throw new ValidationError("Enviar currentStock o stockIncrement, no ambos");
        }
        if (targetStock !== undefined) {
          await this.stockRepository.setStockLevel(id, targetStock, tx);
        } else if (increment) {
          const isMix = (updated.hasComponents?.length ?? 0) > 0;
          if (increment > 0 && isMix) {
            await this.stockRepository.processMixProduction(id, increment, tx);
          } else {
            await this.stockRepository.createStockMovement(
              id,
              increment,
              increment < 0 ? "OUT" : "IN",
              tx,
            );
          }
        }

        // 4. Imágenes a eliminar (solo DB; Cloudinary después del commit)
        removedPublicIds = await this.imageService.removeImagesDb(data.removeImages, id, tx);

        return this.productVariantRepository.getById(id, tx);
      });

      await this.imageService.deleteFromCloudinary(removedPublicIds);
      return result;
    } catch (error) {
      await this.imageService.abortImageUpload(uploadedFiles);
      throw error;
    }
  }

  /** Aplica cambios de receta. Devuelve true si hubo cambios. */
  private async applyComponentChanges(
    mixVariantId: number,
    data: UpdateProductVariantDto,
    tx: any,
  ): Promise<boolean> {
    const remove = data.removeComponents ?? [];
    const edit = (data.editComponents ?? []) as ComponentInput[];
    const add = (data.addComponents ?? []) as ComponentInput[];
    if (!remove.length && !edit.length && !add.length) return false;

    for (const c of remove) {
      await this.productVariantRepository.removeComponent(mixVariantId, c.productVariantId, tx);
    }
    for (const c of edit) {
      if (!(Number(c.quantity) > 0)) {
        throw new ValidationError("La cantidad de un componente debe ser mayor a 0");
      }
      await this.productVariantRepository.updateComponentQuantity(
        mixVariantId,
        c.productVariantId,
        c.quantity,
        tx,
      );
    }
    for (const c of add) {
      await this.stockRepository.addComponentToVariant(
        c.productVariantId,
        mixVariantId,
        c.quantity,
        tx,
      );
    }
    await this.stockRepository.recalculateMixPrice(mixVariantId, tx);
    return true;
  }

  /** Variante lista para vender (con producto, ofertas e imágenes). */
  async findForSale(id: number, tx?: any) {
    return this.productVariantRepository.findForSale(id, tx);
  }
}
