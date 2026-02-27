import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { ImageService } from "../services/image.service.ts";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.ts";

export class ProductVariantRepository extends GenericRepositoryImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  protected prisma: PrismaClient;
  protected imageService: ImageService;
  constructor() {
    super("productVariant");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.imageService = new ImageService();
  }

  async updateVariant(
    id: number,
    data: UpdateProductVariantDto,
    uploadedFilesByField?: any[],
    tx?: PrismaClient,
  ) {
    let updateData = data;
    // Crea la query para las imagenes
    if (
      uploadedFilesByField &&
      Array.isArray(uploadedFilesByField) &&
      uploadedFilesByField.length > 0
    ) {
      updateData = {
        ...updateData,
        images: uploadedFilesByField,
      };
    }

    let updatedProductVariant;

    console.log("a ver la data updateada", updateData);
    updatedProductVariant = await super.update(id, updateData, tx);

    return updatedProductVariant;
  }

  /**
   * Create a query for the product variant
   * @param variants Variants to create
   * @param uploadedFilesByField Files to upload by field
   * @returns A query for the product variant with images
   */
  async createBaseVariantQuery(
    variants: CreateProductVariantDto[],
    uploadedFilesByField?: any[],
    tx?: PrismaClient,
  ): Promise<any> {
    const variantMapping = productVariantCreateMapping;
    const result: any[] = [];

    for (let idx = 0; idx < (variants?.length || 0); idx++) {
      const variant: any = variants[idx];
      // construye campos básicos usando tu builder
      let basic = prismaCreateEntityBuilder(variant, variantMapping);

      // añadir imágenes si vienen (uploadedFilesByField puede ser array donde idx corresponde)
      if (uploadedFilesByField && Array.isArray(uploadedFilesByField[idx]) && uploadedFilesByField[idx].length > 0) {
        const imagesQuery = this.imageService.createImageQuery(uploadedFilesByField[idx]);
        basic = {
          ...basic,
          ...imagesQuery,
        };
      }

      result.push(basic);
      console.log("result", basic);
    }

    return result;
  }

  // Activa o desactiva las variantes en lote. También las añade
  async handleVariantsUpdate(
    productId: number,
    activate?: number[],
    deactivate?: number[],
    addVariants?: CreateProductVariantDto[],
    removeVariants?: number[],
    tx?: PrismaClient,
  ) {
    const model = tx ?? this.prisma;
    if (activate) {
      await model.productVariant.updateMany({
        where: { id: { in: activate } },
        data: { active: true },
      });
    }
    if (deactivate) {
      await model.productVariant.updateMany({
        where: { id: { in: deactivate } },
        data: { active: false },
      });
    }
    if (addVariants) {
      const mapping = productVariantCreateMapping;

      for (const variant of addVariants) {
        const variantData = prismaCreateEntityBuilder(
          { ...variant, productId },
          mapping,
        );

        await model.productVariant.create({
          data: variantData,
        });
      }
    }
    if (removeVariants) {
      await model.productVariant.deleteMany({
        where: { id: { in: removeVariants } },
      });
    }
  }

  async recalculateSingleMixPrice(mixVariantId: number, tx?: PrismaClient) {
    try {
      const model = tx ?? this.prisma;
      await model.$executeRaw`SELECT public.recalculate_mix_price(${mixVariantId}::INT)`;
    } catch (error) {
      throw new StoreProcedureError("recalculate_mix_price", error);
    }
  }

  async recalculateAllMixesFromProduct(productId: number, tx?: PrismaClient) {
    try {
      const model = tx ?? this.prisma;
      await model.$executeRaw`SELECT public.recalculate_all_mixes_from_product(${productId}::INT)`;
    } catch (error) {
      throw new StoreProcedureError("recalculate_all_mixes_from_product", error);
    }
  }

  async processMixProduction(
    mixVariantId: number,
    newStock: number,
    tx?: PrismaClient,
  ) {
      const model = tx ?? this.prisma;
      await model.$executeRaw`SELECT public.process_mix_production(${mixVariantId}::INT, ${newStock}::INT)`;
  }

  async createStockMovement(
    mixVariantId: number,
    newStock: number,
    type: string,
    tx?: PrismaClient,
  ) {
      const model = tx ?? this.prisma;
      await model.$executeRaw`SELECT public.create_stock_movement(${mixVariantId}::INT, ${newStock}::INT, ${type}::TEXT)`;
  }

  async removeVariant(
    mixVariantId: number,
    productVariantId: number,
    tx?: PrismaClient,
  ) {
    const model = tx ?? this.prisma;
    return model.dependency.delete({
      where: {
        mixVariantId_productVariantId: {
          mixVariantId: Number(mixVariantId),
          productVariantId: Number(productVariantId),
        },
      },
    });
  }

  async updateMixVariant(
    mixVariantId: number,
    productVariantId: number,
    quantity: number,
    tx?: PrismaClient,
  ) {
    const model = tx ?? this.prisma;
    return model.dependency.update({
      where: {
        mixVariantId_productVariantId: {
          mixVariantId: Number(mixVariantId),
          productVariantId: Number(productVariantId),
        },
      },
      data: {
        quantity,
      },
    });
  }

  async addComponentToVariant(
    // Revisar si esto funciona
    productVariantId: number,
    mixVariantId: number,
    quantity: number,
    tx?: PrismaClient,
  ) {
      const model = tx ?? this.prisma;
      return await model.$executeRaw`SELECT public.add_component_to_variant(${productVariantId}::INT, ${mixVariantId}::INT, ${quantity}::INT)`;
  }
}
