import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { productVariantUpdateMapping } from "../mappings/product-variants/product-variant-update.mapping.ts";
import { productVariantPostProcessingQueryMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";
import { ImageService } from "./image.service.ts";

export class ProductVariantService extends GenericServiceImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  protected prisma: PrismaClient;
  protected imagesService = new ImageService();

  constructor() {
    super("productVariant");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async update(
    id: number,
    data: UpdateProductVariantDto
  ): Promise<BaseResponse<ProductVariantDto>> {
    try {
      if (
        (data.addComponents && data.addComponents.length > 0) ||
        (data.removeComponents && data.removeComponents.length > 0) ||
        (data.editComponents && data.editComponents.length > 0)
      ) {
        await this.handleVariantsUpdate(
          Number(id),
          data.removeComponents,
          data.editComponents,
          data.addComponents
        );
      }

      // Si
      if (data.removeImages && data.removeImages.length > 0) {
        await this.handleImagesUpdates(data.removeImages);
      }

      const mapping = productVariantUpdateMapping;
      const postMapping = productVariantPostProcessingQueryMapping;
      const updateData = prismaUpdateEntityBuilder(data, mapping);
      let updatedVariant;

      console.log("a ver la data updateada", updateData);
      if (!updateData || Object.keys(updateData).length === 0) {
        updatedVariant = await this.prisma.productVariant.findUnique({
          where: { id: Number(id) },
          include: {
            contentMeasure: true,
            isComponentOf: { include: { mixVariant: true } },
            hasComponents: { include: { componentProduct: true } },
          },
        });
        //Post processing mapping
        if (postMapping && updatedVariant) {
          updatedVariant = postMapping(updatedVariant as any);
        }
        return new BaseResponse(
          200,
          "Entidad editada correctamente",
          updatedVariant as any
        );
      } else {
        updatedVariant = await this.prisma.productVariant.update({
          where: { id: Number(id) },
          data: updateData,
          include: {
            contentMeasure: true,
            isComponentOf: { include: { mixVariant: true } },
            hasComponents: { include: { componentProduct: true } },
          },
        });
      }
      //Post processing mapping
      if (postMapping && updatedVariant) {
        updatedVariant = postMapping(updatedVariant as any);
      }

      this.handlePostProcessingQueries(data, id, updatedVariant as any);
      return new BaseResponse(
        200,
        "Entidad editada correctamente",
        updatedVariant
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  }

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
    productVariantId: number,
    removeComponents?: { productId: number }[],
    editComponents?: { productId: number; quantity: number }[],
    addComponents?: { productId: number; quantity: number }[]
  ) {
    if (removeComponents) {
      const componentPromises = removeComponents.map((component: any) => {
        return this.prisma.dependency.delete({
          where: {
            mixVariantId_productVariantId: {
              mixVariantId: Number(productVariantId),
              productVariantId: Number(component.productVariantId),
            },
          },
        });
      });
      await Promise.all(componentPromises);
      await this.prisma
        .$executeRaw`SELECT public.recalculate_mix_price(${productVariantId}::INT)`;
    }
    if (editComponents) {
      const componentPromises = editComponents.map((component: any) => {
        return this.prisma.dependency.update({
          where: {
            mixVariantId_productVariantId: {
              mixVariantId: Number(productVariantId),
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
        .$executeRaw`SELECT public.recalculate_mix_price(${productVariantId}::INT)`;
    }
    if (addComponents) {
      const componentPromises = addComponents.map((component: any) => {
        return this.prisma.$executeRaw`
            SELECT public.add_component_to_variant(${component.productVariantId}::INT, ${productVariantId}::INT, ${component.quantity}::INT)
        `;
      });
      await Promise.all(componentPromises);
      await this.prisma
        .$executeRaw`SELECT public.recalculate_mix_price(${productVariantId}::INT)`;
    }
  }

  async handleImagesUpdates(removeImages?: { id: number }[]) {
    let imagePromises: any[] = [];
    if (removeImages && removeImages.length > 0) {
      const imageIds = removeImages.map((image: any) => image.id);
      console.log("imageIds", imageIds)
      const foundImages = await this.prisma.image.findMany({
        where: {
          id: { in: imageIds },
        },
      });
      console.log("foundImages", foundImages)
      foundImages.forEach((image: any) => {
        imagePromises.push(this.imagesService.cloudinaryDelete(image.public_id));
      });
      await Promise.all(imagePromises);
    }
  }

  async handlePostProcessingQueries(
    requestData: any,
    id: number,
    updatedVariant: any
  ) {
    if (
      (requestData.price || requestData.profitMargin) &&
      updatedVariant.isComponentOf &&
      updatedVariant.isComponentOf.length > 0
    ) {
      await this.prisma
        .$executeRaw`SELECT public.recalculate_all_mixes_from_product(${id}::INT)`;
    }
    if (requestData.stockIncrement) {
      if (
        requestData.stockIncrement > 0 &&
        updatedVariant.hasComponents &&
        updatedVariant.hasComponents.length > 0
      ) {
        await this.prisma
          .$executeRaw`SELECT public.process_mix_production(${id}::INT, ${requestData.stockIncrement}::INT)`;
      } else {
        await this.prisma
          .$executeRaw`SELECT public.create_stock_movement(${id}::INT, ${
          requestData.stockIncrement
        }::INT, ${requestData.stockIncrement < 0 ? "OUT" : "IN"}::TEXT)`;
      }
    }

    if (requestData.currentStock) {
      await this.prisma
        .$executeRaw`SELECT public.create_stock_movement(${id}::INT, ${
        requestData.currentStock
      }::INT, ${"ADJUSTMENT"}::TEXT)`;
    }
  }
}
