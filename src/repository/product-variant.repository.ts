import { GenericRepositoryImpl } from "./generic.repository.js";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.js";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.js";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.js";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.js";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.js";
import { ImageService } from "../services/image.service.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

export class ProductVariantRepository extends GenericRepositoryImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  protected imageService: ImageService;
  constructor() {
    super("productVariant");
    this.imageService = new ImageService();
  }

  async createVariant(
    data: CreateProductVariantDto,
    uploadedFiles?: any[],
    tx?: any,
  ) {
    const createData =
      Array.isArray(uploadedFiles) && uploadedFiles.length > 0
        ? { ...data, images: uploadedFiles }
        : data;
    return super.create(createData, tx);
  }

  async updateVariant(
    id: number,
    data: UpdateProductVariantDto,
    uploadedFiles?: any[],
    tx?: any,
  ) {
    const updateData =
      Array.isArray(uploadedFiles) && uploadedFiles.length > 0
        ? { ...data, images: uploadedFiles }
        : data;
    return super.update(id, updateData, tx);
  }

  /**
   * Arma el `create` anidado de variantes para crear un producto.
   * `uploadedFilesByField[idx]` son las imágenes de la variante idx.
   */
  async createBaseVariantQuery(
    variants: CreateProductVariantDto[],
    uploadedFilesByField?: any[],
  ): Promise<any[]> {
    return (variants ?? []).map((variant: any, idx: number) => {
      const basic = prismaCreateEntityBuilder(variant, productVariantCreateMapping);
      const files = uploadedFilesByField?.[idx];
      if (Array.isArray(files) && files.length > 0) {
        return { ...basic, ...this.imageService.createImageQuery(files) };
      }
      return basic;
    });
  }

  /** Activa, desactiva, agrega o elimina variantes de un producto en lote. */
  async handleVariantsUpdate(
    productId: number,
    activate?: number[],
    deactivate?: number[],
    addVariants?: CreateProductVariantDto[],
    removeVariants?: number[],
    tx?: any,
  ) {
    const model = this.model(tx);
    try {
      if (activate?.length) {
        await model.updateMany({
          where: { id: { in: activate.map(Number) }, productId },
          data: { active: true },
        });
      }
      if (deactivate?.length) {
        await model.updateMany({
          where: { id: { in: deactivate.map(Number) }, productId },
          data: { active: false },
        });
      }
      const created: any[] = [];
      for (const variant of addVariants ?? []) {
        created.push(
          await model.create({
            data: prismaCreateEntityBuilder(
              { ...variant, currentStock: 0, productId },
              productVariantCreateMapping,
            ),
          }),
        );
      }
      if (removeVariants?.length) {
        // Una variante con ventas/movimientos no se puede borrar: se desactiva.
        await model.updateMany({
          where: { id: { in: removeVariants.map(Number) }, productId },
          data: { active: false, availableWeb: false, availablePedidosYa: false },
        });
      }
      return created;
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async removeComponent(mixVariantId: number, componentVariantId: number, tx?: any) {
    try {
      return await (tx ?? this.prisma).dependency.delete({
        where: {
          mixVariantId_productVariantId: {
            mixVariantId: Number(mixVariantId),
            productVariantId: Number(componentVariantId),
          },
        },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async updateComponentQuantity(
    mixVariantId: number,
    componentVariantId: number,
    quantity: number,
    tx?: any,
  ) {
    try {
      return await (tx ?? this.prisma).dependency.update({
        where: {
          mixVariantId_productVariantId: {
            mixVariantId: Number(mixVariantId),
            productVariantId: Number(componentVariantId),
          },
        },
        data: { quantity: Number(quantity) },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  /** Variante con lo necesario para vender: producto, ofertas e imágenes. */
  async findForSale(id: number, tx?: any) {
    return (tx ?? this.prisma).productVariant.findUnique({
      where: { id: Number(id) },
      include: {
        product: { include: { offers: true } },
        offers: true,
        images: true,
      },
    });
  }
}
