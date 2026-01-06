import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";

export class ProductVariantRepository extends GenericRepositoryImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  protected prisma: PrismaClient;
  constructor() {
    super("product-variant");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
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

      const filesForVariant: any[] = Array.isArray(uploadedFilesByField)
        ? uploadedFilesByField
        : [];

      result = {
        ...basic,
      };

      // Si tiene imágenes disponibles, las gestiona
      if (filesForVariant.length > 0) {
        const imagesCreate =
          filesForVariant.length > 0
            ? filesForVariant.map((u: any) => ({
                public_id: u.public_id,
                secure_url: u.secure_url,
              }))
            : undefined;

        // si tiene componentes, construir create para hasComponents más abajo en la transacción
        result = {
          ...basic,
          ...(imagesCreate ? { images: { create: imagesCreate } } : {}),
        };
      }
    });
    return result;
  }

  // TODO: Esto lo tiene que hacer product variant repository
  async handleVariantsUpdate(
    productId: number,
    activate?: number[],
    deactivate?: number[],
    addVariants?: CreateProductVariantDto[]
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
  }
}
