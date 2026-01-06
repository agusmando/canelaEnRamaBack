import { PrismaClient } from "@prisma/client";
import { CreateProductDto } from "../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productVariantPostProcessingQueryMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";
import { productCreateMapping } from "../mappings/products/product-create.mapping.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { ServerError } from "../errors/application/ServerError.ts";
import { ProductVariantRepository } from "../repository/product-variant.repository.ts";

export class ProductRepository extends GenericRepositoryImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  protected prisma: PrismaClient;
  protected productVariantService = new ProductVariantRepository();
  constructor() {
    super("product");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
  async create(
    createData: CreateProductDto,
    uploadedFilesByField?: Record<string, any[]>
  ): Promise<any> {
    const mapping = productCreateMapping;

    // Crea la query para las variantes del producto (campos normales)
    const variants = await this.productVariantService.createBaseVariantQuery(
      createData.variants,
      uploadedFilesByField
    );

    // let finalPrice: number = 0;
    // let finalStock: number = 0;
    // if (variants.length === 1 && variants[0].hasComponents.length > 0) {
    //   ({ finalPrice, finalStock } = await this.getFinalPriceAndStockForMix(
    //     variants[0].hasComponents,
    //     variants[0].measureTypeId,
    //     variants[0].currentStock || 0
    //   ));
    // }

    // Crea la query para el producto y agrega las variantes
    const finalQuery = prismaCreateEntityBuilder(createData, mapping);
    const data: any = {
      ...finalQuery,
      variants: { create: variants },
    };

    if (
      variants.length === 1 &&
      variants[0].hasComponents &&
      variants[0].hasComponents.length > 0
    ) {
      data.variants = {
        create: [
          {
            ...variants[0],
            hasComponents: {
              create: variants[0].hasComponents.map(
                (component: any) =>
                  ({
                    productVariantId: Number(component.productVariantId),
                    quantity: component.quantity,
                  } as any)
              ),
            },
          },
        ],
      };
    }

    console.log(data);
    console.log(JSON.stringify(data.variants));
    let product = await this.prisma.product.create({
      data,
      include: {
        Tags: true,
        Category: true,
        Brand: true,
        variants: {
          include: {
            isComponentOf: { include: { mixVariant: true } },
            hasComponents: { include: { componentProduct: true } },
            images: true,
          },
        },
      },
    });

    const postMapping = productVariantPostProcessingQueryMapping;

    const postVariants = product.variants.map((variant: any) => {
      if (!variant.profitMargin || !variant.price) return variant;
      return postMapping(variant);
    });
    product.variants = postVariants;

    return product;
  }

  async recalculateMixPrice(mixVariantId: number) {
    await this.prisma
      .$executeRaw`SELECT public.recalculate_mix_price(${mixVariantId}::INT)`;
  }
}
