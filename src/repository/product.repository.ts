import { GenericRepositoryImpl } from "./generic.repository.js";
import { CreateProductDto } from "../dto/products/create-product.dto.js";
import { ProductDto } from "../dto/products/product.dto.js";
import { UpdateProductDto } from "../dto/products/update-product.dto.js";
import { ProductVariantRepository } from "../repository/product-variant.repository.js";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";
import { productPostProcessingMapping } from "../mappings/products/product-post-procesing.mapping.js";

export class ProductRepository extends GenericRepositoryImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  protected productVariantRepository: ProductVariantRepository;
  constructor(productVariantRepository = new ProductVariantRepository()) {
    super("product");
    this.productVariantRepository = productVariantRepository;
  }

  /**
   * Crea el producto con sus variantes anidadas.
   * @param filesByVariant imágenes ya subidas, una lista por variante (mismo índice).
   */
  async createProduct(
    createData: CreateProductDto,
    filesByVariant?: any[][],
    tx?: any,
  ): Promise<any> {
    const variants = await this.productVariantRepository.createBaseVariantQuery(
      createData.variants,
      filesByVariant,
    );
    return super.create({ ...createData, variants: { create: variants } }, tx);
  }

  async addRemoveTags(
    id: number,
    tagData: UpdateProductTagDto,
    addingTag: boolean,
    tx?: any,
  ): Promise<any> {
    try {
      const product = await (tx ?? this.prisma).product.update({
        where: { id },
        data: {
          Tags: {
            [addingTag ? "connect" : "disconnect"]: tagData.tagsId.map((tag: any) => ({
              id: Number(tag?.id ?? tag),
            })),
          },
        },
        include: { Tags: true, variants: true, Category: true, Brand: true },
      });
      return productPostProcessingMapping(product as any);
    } catch (error) {
      throw translatePrismaError(error);
    }
  }
}
