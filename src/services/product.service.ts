import { ImageRepository } from "./../repository/image.repository";
import cloudinary from "cloudinary";
import { CreateProductDto } from "./../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../errors/AppError.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { DependencyDto } from "../dto/dependency/dependency.dto.ts";
import { productCreateMapping } from "../mappings/products/product-create.mapping.ts";
import { prismaCreateEntityBuilder } from "../utils/prismaCreateEntityBuilder.ts";
import { productUpdateMapping } from "../mappings/products/product-update.mapping.ts";
import { productPostProcessingQueryMapping } from "../mappings/products/product-post-procesing.mapping.ts";
import { prismaUpdateEntityBuilder } from "../utils/prismaUpdateEntityBuilder.ts";
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { productVariantCreateMapping } from "../mappings/product-variants/product-variant-create.mapping.ts";
import { productVariantPostProcessingQueryMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";
import { ProductHasNoVariantsError } from "../errors/domain/product/ProductHasNoVariantsError.ts";
import { InvalidMeasureError } from "../errors/domain/product/InvalidMeasureError.ts";
import { ProductHasNoCategoryError } from "../errors/domain/product/ProductHasNoCategoryError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { ProductRepository } from "../repository/product.repository.ts";
import { ExternalServiceError } from "../errors/infra/ExternalServiceError.ts";

export class ProductService extends GenericServiceImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  productRepository: ProductRepository;
  imageRepository: ImageRepository;

  constructor() {
    super("product");
    this.productRepository = new ProductRepository();
    this.imageRepository = new ImageRepository();
  }

  async create(
    createData: CreateProductDto,
    uploadedFilesByField?: Record<string, any[]>
  ): Promise<ProductDto> {
    if (createData.variants.length == 0 || !createData.variants) {
      await this.imageRepository.abortImageUpload(uploadedFilesByField);
      throw new ProductHasNoVariantsError();
    }
    if (createData.measureTypeId == 0 || !createData.measureTypeId) {
      await this.imageRepository.abortImageUpload(uploadedFilesByField);
      throw new InvalidMeasureError();
    }
    if (createData.categoryId == 0 || !createData.categoryId) {
      await this.imageRepository.abortImageUpload(uploadedFilesByField);
      throw new ProductHasNoCategoryError();
    }
    if (!createData.name || createData.description == "") {
      await this.imageRepository.abortImageUpload(uploadedFilesByField);
      throw new ValidationError();
    }
    // cleanup: eliminar uploads recién subidos en Cloudinary

    const product = await this.productRepository.create(
      createData,
      uploadedFilesByField
    );

    if (
      createData?.variants &&
      createData.variants[0] &&
      createData.variants[0].hasComponents &&
      createData.variants[0].hasComponents.length > 0
    ) {
      await this.productRepository.recalculateMixPrice(product.variants[0].id);
    }

    return product;
  }

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

          include: {
            Tags: true,
            Category: true,
            Brand: true,
            variants: {
              include: {
                isComponentOf: { include: { mixVariant: true } },
                hasComponents: { include: { componentProduct: true } },
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

          include: {
            Tags: true,
            Category: true,
            Brand: true,
            variants: {
              include: {
                isComponentOf: { include: { mixVariant: true } },
                hasComponents: { include: { componentProduct: true } },
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
        include: {
          Tags: true,
          Category: true,
          Brand: true,
          variants: {
            include: {
              isComponentOf: { include: { mixVariant: true } },
              hasComponents: { include: { componentProduct: true } },
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
        include: {
          Tags: true,
          Category: true,
          Brand: true,
          variants: {
            include: {
              isComponentOf: { include: { mixVariant: true } },
              hasComponents: { include: { componentProduct: true } },
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
        include: {
          isComponentOf: { include: { mixVariant: true } },
          hasComponents: { include: { componentProduct: true } },
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
