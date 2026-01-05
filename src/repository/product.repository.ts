import { PrismaClient } from "@prisma/client";
import { CreateProductDto } from "../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productVariantPostProcessingQueryMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";
import { AppError } from "../errors/AppError.ts";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";

export class ProductRepository extends GenericRepositoryImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  protected prisma: PrismaClient;
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
    try {
      const mapping = productCreateMapping;
      const variantMapping = productVariantCreateMapping;

      const variants = createData.variants?.map(
        (variant: any, index: number) => {
          const basic = prismaCreateEntityBuilder(variant, variantMapping);
          // Buscar archivos asociados: campo esperado 'variant_<index>'
          console.log(uploadedFilesByField);
          const filesForVariant: any[] = Array.isArray(uploadedFilesByField)
            ? uploadedFilesByField
            : [];
          const imagesCreate =
            filesForVariant.length > 0
              ? filesForVariant.map((u: any) => ({
                  public_id: u.public_id,
                  secure_url: u.secure_url,
                }))
              : undefined;

          // si tiene componentes, construir create para hasComponents más abajo en la transacción
          const result: any = {
            ...basic,
            ...(imagesCreate ? { images: { create: imagesCreate } } : {}),
          };
          console.log(result);
          return result;
        }
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
      if (
        createData?.variants &&
        createData.variants[0] &&
        createData.variants[0].hasComponents &&
        createData.variants[0].hasComponents.length > 0
      ) {
        await this.prisma
          .$executeRaw`SELECT public.recalculate_mix_price(${product.variants[0].id}::INT)`;
      } //No está calculando el valor del mix

      return new BaseResponse(200, "Producto creado correctamente", product);
    } catch (error) {
      // cleanup: eliminar uploads recién subidos en Cloudinary
      if (uploadedFilesByField) {
        const allUploaded = Object.values(uploadedFilesByField).flat();
        await Promise.allSettled(
          allUploaded.map((u: any) =>
            u && u.public_id
              ? cloudinary.v2.uploader.destroy(u.public_id, {
                  resource_type: "image",
                })
              : Promise.resolve()
          )
        );
      }
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }
}
