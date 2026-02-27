import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { CreateProductDto } from "../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productCreateMapping } from "../mappings/products/product-create.mapping.ts";
import { ProductVariantRepository } from "../repository/product-variant.repository.ts";
import { productUpdateMapping } from "../mappings/products/product-update.mapping.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.ts";
import { ImageService } from "../services/image.service.ts";

export class ProductRepository extends GenericRepositoryImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  protected prisma: PrismaClient;
  protected productVariantRepository: ProductVariantRepository;
  protected imageService: ImageService;
  constructor() {
    super("product");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.productVariantRepository = new ProductVariantRepository();
    this.imageService = new ImageService();
  }
  async createProduct(
    createData: CreateProductDto,
    uploadedFilesByField?: any[],
    tx?: PrismaClient
  ): Promise<any> {
    const mapping = productCreateMapping;
    
    // Crea la query para las variantes del producto (campos normales)
    const variants = await this.productVariantRepository.createBaseVariantQuery(
      createData.variants,
      uploadedFilesByField
    );
    console.log("Pasa variantes", variants);

    // const finalQuery = prismaCreateEntityBuilder(createData, mapping);
    const data: any = {
      ...createData,
      variants: { create: variants },
    };

    console.log("data", data)

    // TODO: Pensar en la creación múltiple de variantes
    // Si la primera variante tiene componentes, las agrega a su query
    // if (
    //   variants.length === 1 &&
    //   variants[0].hasComponents &&
    //   variants[0].hasComponents.length > 0
    // ) {
    //   data.variants = {
    //     ...variants[0],
    //     hasComponents: {
    //       create: variants[0].hasComponents.map(
    //         (component: any) =>
    //           ({
    //             productVariantId: Number(component.productVariantId),
    //             quantity: component.quantity,
    //           } as any)
    //       ),
    //     },
    //   };
    // }

    console.log(data);
    console.log(JSON.stringify(data.variants));
    // Crea el producto
    let product = await super.create(data, tx);

    return product;
  }

  async addRemoveTags(
    id: number,
    tagData: UpdateProductTagDto,
    addingTag: boolean,
    tx?: PrismaClient
  ): Promise<any> {
    let data = {
      Tags: {
        [addingTag ? "connect" : "disconnect"]: tagData.tagsId.map(
          (tagId: any) => ({ id: tagId.id })
        ),
      },
    };
    console.log(JSON.stringify(data));
    
    const model = tx ?? this.prisma;
    return await model.product.update({
      where: { id },
      data,
      include: {
        Tags: true,
        variants: true,
        Category: true,
        Brand: true,
      },
    });
  }
}