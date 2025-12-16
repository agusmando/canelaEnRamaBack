import { CreateProductDto } from "./../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { DependencyDto } from "../dto/dependency/dependency.dto.ts";
import { productCreateMapping } from "../mappings/products/products-create.mapping.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productUpdateMapping } from "../mappings/products/product-update.mapping.ts";
import { productPostProcessingQueryMapping } from "../mappings/products/product-post-procesing.mapping.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { productVariantPostProcessingQueryMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";

export class ProductService extends GenericServiceImpl<
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
    createData: CreateProductDto
  ): Promise<BaseResponse<ProductDto>> {
    try {
      const mapping = productCreateMapping;
      const variantMapping = productVariantCreateMapping;

      const variants = createData.variants?.map((variant: any) => {
        return prismaCreateEntityBuilder(variant, variantMapping);
      });

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
                      productVariantId: component.productVariantId,
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
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          Tags: true,
          Category: true,
          Brand: true,
          variants: {
            include: {
              isComponentOf: { include: { componentProduct: true } },
              hasComponents: { include: { mixVariant: true } },
            },
          },
          // isComponentOf: { include: { mixProduct: true } },
          // hasComponents: { include: { componentProduct: true } },
        },
      });

      const postMapping = productVariantPostProcessingQueryMapping;

      const postVariants = product.variants.map((variant: any) => {
        if (!variant.profitMargin || !variant.price) return variant;
        return postMapping(variant);
      });
      product.variants = postVariants;
      if (data.hasComponents && data.hasComponents.length > 0) {
        await this.prisma
          .$executeRaw`SELECT public.recalculate_mix_price(${product.variants[0].id}::INT)`;
      } //No está calculando el valor del mix

      return new BaseResponse(200, "Producto creado correctamente", product);
    } catch (error) {
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }

  // async createVariant(
  //   createData: CreateProductVariantDto,
  //   productId: number
  // ): Promise<any> {
  //   try {
  //     let finalPrice = createData.price || 0;
  //     let finalStock = createData.currentStock || 0;
  //     const measure = await this.prisma.measureType.findUnique({
  //       where: {
  //         id: createData.measureTypeId,
  //       },
  //     });
  //     if (createData.hasComponents) {
  //       if (!["G", "U"].includes(measure?.name || "")) {
  //         throw new AppError(ErrorsEnum.INVALID_MEASURE);
  //       } // esto ya no importa, total es el measure de las variantes, no el producto padre
  //       const mixStatus = await this.handleMixOperations(
  //         createData.hasComponents,
  //         measure?.name || "",
  //         createData.currentStock
  //       );
  //       finalPrice = mixStatus.finalPrice;
  //       finalStock = mixStatus.finalStock;
  //     }

  //     const mapping = productVariantCreateMapping;
  //     const finalQuery = prismaCreateEntityBuilder(createData, mapping);
  //     const data: any = {
  //       ...finalQuery,
  //       price: finalPrice,
  //       currentStock: finalStock,
  //       productId,
  //     };
  //     if (createData.hasComponents && createData.hasComponents.length > 0) {
  //       if (createData.hasComponents.length)
  //         data.hasComponents = {
  //           create: createData.hasComponents.map(
  //             (component: any) =>
  //               ({
  //                 productId: component.productId,
  //                 quantity: component.quantity,
  //               } as any)
  //           ),
  //         };
  //     }

  //     return await this.prisma.productVariant.create({
  //       data,
  //       select: {
  //         id: true,
  //         name: true,
  //         price: true,
  //         active: true,
  //         isComponentOf: { include: { componentProduct: true } },
  //         hasComponents: { include: { mixVariant: true } },
  //       },
  //     });
  //   } catch (error) {
  //     throw new AppError(ErrorsEnum.SERVER_ERROR);
  //   }
  // }

  async update(
    id: number,
    data: UpdateProductDto
  ): Promise<BaseResponse<ProductDto>> {
    try {
      if (
        (data.addVariants && data.addVariants.length > 0) ||
        (data.activateVariants && data.activateVariants.length > 0) ||
        (data.deactivateVariants && data.deactivateVariants.length > 0)
      ) {
        await this.handleVariantsUpdate(
          Number(id),
          data.activateVariants,
          data.deactivateVariants,
          data.addVariants
        );
      }
      const mapping = productUpdateMapping;
      const postMapping = productPostProcessingQueryMapping;
      const updateData = prismaUpdateEntityBuilder(data, mapping);
      let updatedProduct;

      console.log("a ver la data updateada", updateData);
      if (!updateData || Object.keys(updateData).length === 0) {
        updatedProduct = await this.prisma.product.findUnique({
          where: { id: Number(id) },
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
            Tags: true,
            Category: true,
            Brand: true,
            variants: {
              include: {
                isComponentOf: { include: { componentProduct: true } },
                hasComponents: { include: { mixVariant: true } },
              },
            },
          },
        });
        //Post processing mapping
        if (postMapping && updatedProduct) {
          updatedProduct = postMapping(updatedProduct as any);
        }
        return new BaseResponse(
          200,
          "Entidad editada correctamente",
          updatedProduct as any
        );
      } else {
        updatedProduct = await this.prisma.product.update({
          where: { id: Number(id) },
          data: updateData,
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
            Tags: true,
            Category: true,
            Brand: true,
            variants: {
              include: {
                isComponentOf: { include: { componentProduct: true } },
                hasComponents: { include: { mixVariant: true } },
              },
            },
          },
        });
      }
      //Post processing mapping
      if (postMapping && updatedProduct) {
        updatedProduct = postMapping(updatedProduct as any);
      }
      console.log(data);
      // if (data.price || data.profitMargin) {
      //   await this.prisma
      //     .$executeRaw`SELECT public.recalculate_all_mixes_from_product(${id}::INT)`;
      // }
      return new BaseResponse(
        200,
        "Entidad editada correctamente",
        updatedProduct
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }

  addProductTags: (
    productId: number,
    tagData: UpdateProductTagDto
  ) => Promise<BaseResponse<ProductDto>> = async (
    productId: number,
    tagData: UpdateProductTagDto
  ) => {
    try {
      console.log(tagData);
      const updatedProduct = await this.prisma.product.update({
        where: { id: Number(productId) },
        data: {
          Tags: {
            connect: tagData.tagsId.map((tagId: any) => ({ id: tagId.id })),
          },
        } as any,
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          Tags: true,
          Category: true,
          Brand: true,
          variants: {
            include: {
              isComponentOf: { include: { componentProduct: true } },
              hasComponents: { include: { mixVariant: true } },
            },
          },
        },
      });
      return new BaseResponse(
        200,
        "Producto editado correctamente",
        updatedProduct
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  removeProductTags: (
    productId: number,
    tagData: UpdateProductTagDto
  ) => Promise<BaseResponse<ProductDto>> = async (
    productId: number,
    tagData: UpdateProductTagDto
  ) => {
    try {
      const updatedProduct = await this.prisma.product.update({
        where: { id: Number(productId) },
        data: {
          Tags: {
            disconnect: tagData.tagsId.map((tag: any) => ({ id: tag.id })),
          },
        } as any,
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          Tags: true,
          Category: true,
          Brand: true,
          variants: {
            include: {
              isComponentOf: { include: { componentProduct: true } },
              hasComponents: { include: { mixVariant: true } },
            },
          },
        },
      });
      return new BaseResponse(
        200,
        "Producto editado correctamente",
        updatedProduct
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  async handleMixOperations(
    addComponents?: { productVariantId: number; quantity: number }[],
    editComponents?: { productVariantId: number; quantity: number }[],
    removeComponents?: { productVariantId: number; mixVariantId: number }[],
    variantId?: number
  ) {
    if (addComponents && addComponents.length > 0) {
      console.log(addComponents);
      const componentPromises = addComponents.map((component: any) => {
        return this.prisma.$executeRaw`
          SELECT public.add_component_to_variant(${component.productVariantId}::INT, ${variantId}::INT, ${component.quantity}::INT)
      `;
      });
      await Promise.all(componentPromises);
      await this.prisma
        .$executeRaw`SELECT public.recalculate_mix_price(${variantId}::INT)`;
    }
    if (editComponents && editComponents.length > 0) {
      const componentPromises = editComponents.map((component: any) => {
        return this.prisma.dependency.update({
          where: {
            mixVariantId_productVariantId: {
              mixVariantId: Number(variantId),
              productVariantId: Number(component.productVariantId),
            },
          },
          data: {
            quantity: component.quantity,
          },
        });
      });
      await Promise.all(componentPromises);
      await this.prisma
        .$executeRaw`SELECT public.recalculate_mix_price(${variantId}::INT)`;
    }
    if (removeComponents && removeComponents.length > 0) {
      const componentPromises = removeComponents.map((component: any) => {
        return this.prisma.dependency.delete({
          where: {
            mixVariantId_productVariantId: {
              mixVariantId: Number(variantId),
              productVariantId: Number(component.productVariantId),
            },
          },
        });
      });
      await Promise.all(componentPromises);
      await this.prisma
        .$executeRaw`SELECT public.recalculate_mix_price(${variantId}::INT)`;
    }
  }

  async getFinalPriceAndStockForMix(
    variantsList: {
      productVariantId: number;
      quantity: number;
    }[],
    measureId: number,
    sugestedStock: number
  ) {
    let finalPrice = 0;
    let finalStock = 0;
    const contentMeasure = await this.prisma.measureType.findUnique({
      where: {
        id: measureId,
      },
    });
    if (!contentMeasure) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    const duplicateArray = variantsList; //id producto y quantity
    const containingVariantIds = duplicateArray.map(
      (component: any) => component.productVariantId
    );
    let foundVariants;
    try {
      foundVariants = await this.prisma.productVariant.findMany({
        where: {
          id: {
            in: containingVariantIds,
          },
        },
        select: {
          id: true,
          price: true,
          profitMargin: true,
          contentMeasure: true,
          currentStock: true,
        },
      });
      console.log(foundVariants);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }

    let stock = 0;
    let stockForUnit: number[] = [];
    foundVariants.forEach((productVariant: any) => {
      const currentDependency = duplicateArray.find(
        (component: any) => component.productVariantId === productVariant.id
      );
      if (!currentDependency) {
        throw new AppError(ErrorsEnum.NOT_FOUND);
      }
      if (productVariant.currentStock)
        if (contentMeasure.name === "U") {
          // if (contentMeasure.name === "G") {
          //   if (product.contentMeasure.name !== "G") {
          //     throw new AppError(ErrorsEnum.INVALID_MEASURE);
          //   }
          //   stock += currentDependency?.quantity || 0;
          // }
          stockForUnit.push(
            productVariant?.currentStock / productVariant?.quantity || 0
          );
        }

      console.log({
        price: productVariant.price,
        profitMargin: productVariant.profitMargin,
        quantity: currentDependency.quantity,
      });
      finalPrice += Math.round(
        (productVariant.price * productVariant.profitMargin +
          productVariant.price) *
          currentDependency?.quantity
      );
    });

    // if (contentMeasure.name === "G") {
    //   finalStock = sugestedStock;
    // }
    if (contentMeasure.name === "U") {
      finalStock = Math.min(...(stockForUnit || []));
    }
    console.log("finalStock", finalStock);
    //hasta acá recopilamos finalPrice y finalStock. Hay que crear la query de creación también.
    return { finalPrice, finalStock };
  }

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
