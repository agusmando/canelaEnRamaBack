import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { DependencyDto } from "../dto/dependency/dependency.dto.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";

export class ProductVariantService extends GenericServiceImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  protected prisma: PrismaClient;

  constructor() {
    super("productVariant");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async create(
    createData: CreateProductVariantDto
  ): Promise<BaseResponse<ProductVariantDto>> {
    try {
      const mapping = productVariantCreateMapping;
      const variantMapping = productVariantCreateMapping;
      const variants = createData.variants.map((variant: any) => {
        return prismaCreateEntityBuilder(variant, variantMapping);
      });
      const finalQuery = prismaCreateEntityBuilder(createData, mapping);
      const data: any = {
        ...finalQuery,
        variants: { create: variants },
      };

      console.log(data);
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
          variants: true,
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
      // const promises: Promise<any>[] = [];
      // createData.variants.forEach(async (variant: any) => {
      //   promises.push(this.createVariant(variant, product.id));
      // });
      // await Promise.all(promises);

      return new BaseResponse(200, "Producto creado correctamente", product);
    } catch (error) {
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }

  async createVariant(
    createData: CreateProductVariantDto,
    productId: number
  ): Promise<any> {
    try {
      let finalPrice = createData.price || 0;
      let finalStock = createData.currentStock || 0;
      const measure = await this.prisma.measureType.findUnique({
        where: {
          id: createData.measureTypeId,
        },
      });
      if (createData.hasComponents) {
        if (!["G", "U"].includes(measure?.name || "")) {
          throw new AppError(ErrorsEnum.INVALID_MEASURE);
        } // esto ya no importa, total es el measure de las variantes, no el producto padre
        const mixStatus = await this.handleMixCreation(
          createData.hasComponents,
          measure?.name || "",
          createData.currentStock
        );
        finalPrice = mixStatus.finalPrice;
        finalStock = mixStatus.finalStock;
      }

      const mapping = productVariantCreateMapping;
      const finalQuery = prismaCreateEntityBuilder(createData, mapping);
      const data: any = {
        ...finalQuery,
        price: finalPrice,
        currentStock: finalStock,
        productId,
      };
      if (createData.hasComponents && createData.hasComponents.length > 0) {
        if (createData.hasComponents.length)
          data.hasComponents = {
            create: createData.hasComponents.map(
              (component: any) =>
                ({
                  productId: component.productId,
                  quantity: component.quantity,
                } as any)
            ),
          };
      }

      return await this.prisma.productVariant.create({
        data,
        select: {
          id: true,
          name: true,
          price: true,
          active: true,
          isComponentOf: { include: { componentProduct: true } },
          hasComponents: { include: { mixVariant: true } },
        },
      });
    } catch (error) {
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }

  async update(
    id: number,
    data: UpdateProductVariantDto
  ): Promise<BaseResponse<ProductVariantDto>> {
    try {
      //   if (data.addComponents && data.addComponents.length > 0) {
      //     console.log(data.addComponents);
      //     const componentPromises = data.addComponents.map((component: any) => {
      //       return this.prisma.$executeRaw`
      //     SELECT public.add_component_to_product(${component.productId}::INT, ${id}::INT, ${component.quantity}::INT)
      // `;
      //     });
      //     await Promise.all(componentPromises);
      //     await this.prisma
      //       .$executeRaw`SELECT public.recalculate_mix_price(${id}::INT)`;
      //   }
      //   if (data.editComponents && data.editComponents.length > 0) {
      //     const componentPromises = data.editComponents.map((component: any) => {
      //       return this.prisma.dependency.update({
      //         where: {
      //           mixId_productId: {
      //             mixId: Number(id),
      //             productId: Number(component.productId),
      //           },
      //         },
      //         data: {
      //           quantity: component.quantity,
      //         },
      //       });
      //     });
      //     await Promise.all(componentPromises);
      //     await this.prisma
      //       .$executeRaw`SELECT public.recalculate_mix_price(${id}::INT)`;
      //   }
      //   if (data.removeComponents && data.removeComponents.length > 0) {
      //     const componentPromises = data.removeComponents.map(
      //       (component: any) => {
      //         return this.prisma.dependency.delete({
      //           where: {
      //             mixId_productId: {
      //               mixId: Number(id),
      //               productId: Number(component.productId),
      //             },
      //           },
      //         });
      //       }
      //     );
      //     await Promise.all(componentPromises);
      //     await this.prisma
      //       .$executeRaw`SELECT public.recalculate_mix_price(${id}::INT)`;
      //   }
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
            variants: true,
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
            variants: true,
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
  ) => Promise<BaseResponse<ProductVariantDto>> = async (
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
  ) => Promise<BaseResponse<ProductVariantDto>> = async (
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

  async handleMixCreation(
    productList: {
      productId: number;
      quantity: number;
    }[],
    measure: string,
    sugestedStock: number
  ) {
    let finalPrice = 0;
    let finalStock = 0;
    const duplicateArray = productList; //id producto y quantity
    const containingProductIds = duplicateArray.map(
      (component: any) => component.productId
    );
    let foundProducts;
    try {
      foundProducts = await this.prisma.productVariant.findMany({
        where: {
          id: {
            in: containingProductIds,
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
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }

    let stock = 0;
    let stockForUnit: number[] = [];
    foundProducts.forEach((product: any) => {
      const currentDependency = duplicateArray.find(
        (component: any) => component.productId === product.id
      );
      if (!currentDependency) {
        throw new AppError(ErrorsEnum.NOT_FOUND);
      }
      if (product.currentStock)
        if (measure === "U") {
          // if (measure === "G") {
          //   if (product.measure !== "G") {
          //     throw new AppError(ErrorsEnum.INVALID_MEASURE);
          //   }
          //   stock += currentDependency?.quantity || 0;
          // }
          stockForUnit.push(product?.currentStock / product?.quantity || 0);
        }

      console.log({
        price: product.price,
        profitMargin: product.profitMargin,
        quantity: currentDependency.quantity,
      });
      finalPrice +=
        (product.price * product.profitMargin + product.price) *
        currentDependency?.quantity;
    });

    // if (measure === "G") {
    //   finalStock = sugestedStock;
    // }
    if (measure === "U") {
      finalStock = Math.min(...(stockForUnit || []));
    }
    console.log("finalStock", finalStock);
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
