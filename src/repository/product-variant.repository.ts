import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { ImageService } from "../services/image.service.ts";

export class ProductVariantRepository extends GenericRepositoryImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  protected prisma: PrismaClient;
  protected imageService: ImageService;
  constructor() {
    super("product-variant");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.imageService = new ImageService();
  }

  /**
   * Create a query for the product variant
   * @param variants Variants to create
   * @param uploadedFilesByField Files to upload by field
   * @returns A query for the product variant with images
   */
  async createBaseVariantQuery(
    variants: CreateProductVariantDto[],
    uploadedFilesByField?: Record<string, any[]>
  ): Promise<any> {
    const variantMapping = productVariantCreateMapping;
    let result: any;
    variants?.forEach((variant: any) => {
      const basic = prismaCreateEntityBuilder(variant, variantMapping);
      result = {
        ...basic,
      }
      if (!!uploadedFilesByField) {
        const images = this.imageService.createImageQuery(
          uploadedFilesByField?.[variant.id]
        );
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
}
