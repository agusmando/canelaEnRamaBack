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
  async create(
    createData: CreateProductDto,
    uploadedFilesByField?: any[]
  ): Promise<any> {
    const mapping = productCreateMapping;

    // Crea la query para las variantes del producto (campos normales)
    const variants = await this.productVariantRepository.createBaseVariantQuery(
      createData.variants,
      uploadedFilesByField
    );

    // Crea la query para el producto y agrega las variantes
    // SI LLAMA A SUPER() ES PROBABLE QUE ESTO DE ACÁ NO HAGA FALTA PORQUE YA SE HACE
    // const finalQuery = prismaCreateEntityBuilder(createData, mapping);
    const data: any = {
      ...createData,
      variants: { create: variants },
    };

    console.log("data", data)

    // TODO: Pensar en la creación múltiple de variantes
    // Si la primera variante tiene componentes, las agrega a su query
    if (
      variants.length === 1 &&
      variants[0].hasComponents &&
      variants[0].hasComponents.length > 0
    ) {
      data.variants = {
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
      };
    }

    console.log(data);
    console.log(JSON.stringify(data.variants));
    // Crea el producto
    let product = await super.create(data);

    return product;
  }

  async update(
    id: number,
    data: UpdateProductDto
    // uploadedFilesByField?: Record<string, any[]>
  ): Promise<ProductDto> {
    // Crea la query para actualizar el producto (campos normales)
    const mapping = productUpdateMapping;
    let updateData = prismaUpdateEntityBuilder(data, mapping);

    // Crea la query para las imagenes
    //  if (uploadedFilesByField && uploadedFilesByField.length > 0) {
    //   const images = this.imageService.createImageQuery(
    //     uploadedFilesByField?.[id]
    //   );
    //   updateData = {
    //     ...updateData,
    //     ...images,
    //   };
    // }

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
  ): Promise<any> {
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
        measure: true,
      },
    });
  }
}


// const creation={
//   data: {
//     name: "Producto prueba completa",
//     description: "Descripción editable",
//     categoryId: 2,
//     brandId: 3,
//     Tags: {
//       connect: [
//         {
//           id: 1
//         },
//         {
//           id: 2
//         }
//       ]
//     },
//     variants: {
//       create: {
//         create: {
//           name: "Variante prueba mix",
//           price: 300,
//           profitMargin: 0.4,
//           measureTypeId: 1,
//           contentAmount: 100,
//           currentStock: 3000,
//           movements: {
//             create: {
//               quantity: 3000,
//               type: "IN"
//             }
//           },
//           images: {
//             create: [
//               {
//                 public_id: "products/d0kffxubmwj5nxirhzm8",
//                 secure_url: "https://res.cloudinary.com/dyyn5wgmm/image/upload/v1767883025/products/d0kffxubmwj5nxirhzm8.png"
//               }
//             ]
//           }
//         },
//        price: Float
//       }
//     },
//     measureTypeId: 5
//   }
// }