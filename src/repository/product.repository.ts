import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { CreateProductDto } from "../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productCreateMapping } from "../mappings/products/product-create.mapping.ts";
import { ProductVariantRepository } from "../repository/product-variant.repository.ts";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { productUpdateMapping } from "../mappings/products/product-update.mapping.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.ts";

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

    // Crea la query para el producto y agrega las variantes
    const finalQuery = prismaCreateEntityBuilder(createData, mapping);
    const data: any = {
      ...finalQuery,
      variants: { create: variants },
    };

    // TODO: Pensar en la creación múltiple de variantes
    // Si la primera variante tiene componentes, las agrega a su query
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
    // Crea el producto
    let product = await super.create(data);

    return product;
  }

  async recalculateMixPrice(mixVariantId: number) {
    await this.prisma
      .$executeRaw`SELECT public.recalculate_mix_price(${mixVariantId}::INT)`;
  }

  async recalculateAllMixesFromProduct(productId: number) {
    await this.prisma
      .$executeRaw`SELECT public.recalculate_all_mixes_from_product(${productId}::INT)`;
  }

  async update(id: number, data: UpdateProductDto): Promise<ProductDto> {
    // Crea la query para actualizar el producto (campos normales)
    const mapping = productUpdateMapping;
    const updateData = prismaUpdateEntityBuilder(data, mapping);
    let updatedProduct;

    console.log("a ver la data updateada", updateData);
    if (!updateData || Object.keys(updateData).length === 0) {
      updatedProduct = await super.getById(id);
    } else {
      updatedProduct = await super.update(id, updateData);
    }
    return updatedProduct;
  }

  async addRemoveTags(
    id: number,
    tagData: UpdateProductTagDto,
    addingTag: boolean
  ) {
    let data = {
      Tags: {
        [addingTag ? "connect" : "disconnect"]: tagData.tagsId.map(
          (tagId: any) => ({ id: tagId.id })
        ),
      },
    };
    console.log(JSON.stringify(data));
    return await this.prisma.product.update({
      where: { id },
      data,
      include: {
        Tags: true,
        variants: true,
        Category: true,
        Brand: true,
      },
    })
  }
}
