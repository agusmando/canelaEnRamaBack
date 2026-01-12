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
    uploadedFilesByField?: any[]
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
    updatedProductVariant = await super.update(id, updateData);

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
    uploadedFilesByField?: any[]
  ): Promise<any> {
    const variantMapping = productVariantCreateMapping;
    let result: any;
    variants?.forEach((variant: any) => {
      const basic = prismaCreateEntityBuilder(variant, variantMapping);
      result = {
        ...basic,
      };
      if (uploadedFilesByField && uploadedFilesByField.length > 0) {
        const images = this.imageService.createImageQuery(uploadedFilesByField);
        result = {
          ...result,
          ...images,
        };
      }
    });
    return result;
  }

  // Activa o desactiva las variantes en lote. También las añade
  async handleVariantsUpdate(
    productId: number,
    activate?: number[],
    deactivate?: number[],
    addVariants?: CreateProductVariantDto[],
    removeVariants?: number[]
  ) {
    if (activate) {
      await this.prisma.productVariant.updateMany({
        where: { id: { in: activate } },
        data: { active: true },
      });
    }
    if (deactivate) {
      await this.prisma.productVariant.updateMany({
        where: { id: { in: deactivate } },
        data: { active: false },
      });
    }
    if (addVariants) {
      const mapping = productVariantCreateMapping;

      for (const variant of addVariants) {
        const variantData = prismaCreateEntityBuilder(
          { ...variant, productId },
          mapping
        );

        await this.prisma.productVariant.create({
          data: variantData,
        });
      }
    }
    if (removeVariants) {
      await this.prisma.productVariant.deleteMany({
        where: { id: { in: removeVariants } },
      });
    }
  }

  async recalculateSingleMixPrice(mixVariantId: number) {
    try {
      await this.prisma
        .$executeRaw`SELECT public.recalculate_mix_price(${mixVariantId}::INT)`;
    } catch (error) {
      throw new StoreProcedureError("recalculate_mix_price");
    }
  }

  async recalculateAllMixesFromProduct(productId: number) {
    try {
      await this.prisma
        .$executeRaw`SELECT public.recalculate_all_mixes_from_product(${productId}::INT)`;
    } catch (error) {
      throw new StoreProcedureError("recalculate_all_mixes_from_product");
    }
  }

  async processMixProduction(mixVariantId: number, newStock: number) {
    try {
      await this.prisma
        .$executeRaw`SELECT public.create_stock_movement(${mixVariantId}::INT, ${newStock}::INT, ${"ADJUSTMENT"}::TEXT)`;
    } catch (error) {
      throw new StoreProcedureError("create_stock_movement");
    }
  }

  async createStockMovement(
    mixVariantId: number,
    newStock: number,
    type: string
  ) {
    try {
      await this.prisma
        .$executeRaw`SELECT public.create_stock_movement(${mixVariantId}::INT, ${newStock}::INT, ${type}::TEXT)`;
    } catch (error) {
      throw new StoreProcedureError("create_stock_movement");
    }
  }

  async removeVariant(mixVariantId: number, productVariantId: number) {
    return this.prisma.dependency.delete({
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
    quantity: number
  ) {
    return this.prisma.dependency.update({
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
    quantity: number
  ) {
    try {
      return await this.prisma
        .$executeRaw`SELECT public.add_component_to_variant(${productVariantId}::INT, ${mixVariantId}::INT, ${quantity}::INT)`;
    } catch (error) {
      throw new StoreProcedureError("add_component_to_variant");
    }
  }
}
