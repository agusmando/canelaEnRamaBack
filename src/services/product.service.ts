import { CreateProductDto } from "./../dto/products/create-product.dto.js";
import { ProductDto } from "../dto/products/product.dto.js";
import { UpdateProductDto } from "../dto/products/update-product.dto.js";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.js";
import {
  ProductHasNoVariantsError,
  InvalidMeasureError,
  ProductHasNoCategoryError,
} from "../errors/domain/product/index-product.error.js";
import { ValidationError, NotFoundError, BadRequestError } from "../errors/application/index-app.error.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { ProductRepository } from "../repository/product.repository.js";
import { ProductVariantRepository } from "../repository/product-variant.repository.js";
import { StockMovementRepository } from "../repository/stockMovement.repository.js";
import { ImageService } from "./image.service.js";

/** Con multipart/form-data los arrays/objetos llegan como string JSON. */
const parseJsonField = <T>(value: T | string | undefined): T | undefined => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new BadRequestError("JSON inválido en un campo del formulario");
  }
};

/**
 * `upload.array("image")` deja una lista plana de archivos subidos: se asignan
 * a la primera variante. Si llega una lista por variante, se respeta.
 */
const groupFilesByVariant = (files: any): any[][] => {
  if (!Array.isArray(files) || files.length === 0) return [];
  return Array.isArray(files[0]) ? files : [files];
};

export class ProductService extends GenericServiceImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  readonly productRepository: ProductRepository;
  readonly productVariantRepository: ProductVariantRepository;
  readonly stockRepository: StockMovementRepository;
  readonly imageService: ImageService;

  constructor(
    productVariantRepository = new ProductVariantRepository(),
    productRepository = new ProductRepository(productVariantRepository),
    stockRepository = new StockMovementRepository(),
    imageService = new ImageService(),
  ) {
    super(productRepository);
    this.productRepository = productRepository;
    this.productVariantRepository = productVariantRepository;
    this.stockRepository = stockRepository;
    this.imageService = imageService;
  }

  async createProduct(rawData: CreateProductDto, uploadedFiles: any[]): Promise<ProductDto> {
    try {
      const createData: CreateProductDto = {
        ...rawData,
        variants: parseJsonField(rawData?.variants) ?? [],
        Tags: parseJsonField(rawData?.Tags),
      };

      if (!createData.variants?.length) throw new ProductHasNoVariantsError();
      if (!createData.measure) throw new InvalidMeasureError();
      if (!Number(createData.categoryId)) throw new ProductHasNoCategoryError();
      if (!createData.name) {
        throw new ValidationError("El nombre del producto es requerido");
      }
      if (!Number(createData.brandId)) {
        throw new ValidationError("brandId es requerido");
      }

      // El stock inicial se registra como movimiento, no se escribe directo
      const initialStocks = createData.variants.map((v) => Number(v.currentStock) || 0);
      createData.variants = createData.variants.map((v) => ({ ...v, currentStock: 0 }));

      return await this.productRepository.withTransaction(async (tx) => {
        const product = await this.productRepository.createProduct(
          createData,
          groupFilesByVariant(uploadedFiles),
          tx,
        );

        // Las variantes anidadas se insertan en orden: ordenar por id = orden del body
        const created = [...(product.variants ?? [])].sort((a: any, b: any) => a.id - b.id);
        for (const [idx, variant] of created.entries()) {
          const isMix = (variant.hasComponents?.length ?? 0) > 0;
          if (isMix) {
            await this.stockRepository.recalculateMixPrice(variant.id, tx);
          }
          const stock = initialStocks[idx] ?? 0;
          if (stock > 0) {
            if (isMix) {
              await this.stockRepository.processMixProduction(variant.id, stock, tx);
            } else {
              await this.stockRepository.createStockMovement(variant.id, stock, "IN", tx);
            }
          }
        }
        return this.productRepository.getById(product.id, tx);
      });
    } catch (error) {
      await this.imageService.abortImageUpload(uploadedFiles);
      throw error;
    }
  }

  /**
   * Actualiza datos del producto y gestiona variantes en lote.
   * Los precios/stock se modifican por variante (PUT /product/variant/:id).
   */
  async updateProduct(id: number, data: UpdateProductDto): Promise<ProductDto> {
    if (!id) throw new NotFoundError();
    if (!data) throw new BadRequestError();

    return this.productRepository.withTransaction(async (tx) => {
      const updated = await this.productRepository.update(id, data, tx);
      if (!updated) throw new NotFoundError();

      const hasVariantChanges =
        !!data.addVariants?.length ||
        !!data.activateVariants?.length ||
        !!data.deactivateVariants?.length ||
        !!data.removeVariants?.length;

      if (hasVariantChanges) {
        const added = await this.productVariantRepository.handleVariantsUpdate(
          Number(id),
          data.activateVariants,
          data.deactivateVariants,
          data.addVariants,
          data.removeVariants,
          tx,
        );
        // Stock inicial de las variantes nuevas como movimiento IN
        for (const [idx, variant] of added.entries()) {
          const stock = Number(data.addVariants?.[idx]?.currentStock) || 0;
          if (stock > 0) {
            await this.stockRepository.createStockMovement(variant.id, stock, "IN", tx);
          }
        }
      }
      return this.productRepository.getById(id, tx);
    });
  }

  async addRemoveProductTags(
    productId: number,
    tagData: UpdateProductTagDto,
    addingTag: boolean,
  ): Promise<ProductDto> {
    if (!productId) throw new NotFoundError();
    if (!tagData?.tagsId?.length) {
      throw new ValidationError("Tag ids are required for adding tags to product");
    }
    return this.productRepository.addRemoveTags(Number(productId), tagData, addingTag);
  }
}
