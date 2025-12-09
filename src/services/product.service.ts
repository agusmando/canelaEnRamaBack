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
      let finalPrice = createData.price || 0;
      if (createData.isComponentOf) {
        const duplicateArray = createData.isComponentOf; //id producto y quantity
        const containingProductIds = duplicateArray.map(
          (component: any) => component.id
        );
        const foundProducts = await this.prisma.product.findMany({
          where: {
            id: {
              in: containingProductIds,
            },
          },
          select: {
            id: true,
            price: true,
            profitMargin: true,
          },
        });
        finalPrice = 0;
        foundProducts.forEach((product: any) => {
          const currentDependency = duplicateArray.find(
            (component: any) => component.id === product.id
          );
          if (!currentDependency) return;
          console.log({
            price: product.price,
            profitMargin: product.profitMargin,
            quantity: currentDependency.quantity,
          });
          finalPrice +=
            (product.price * product.profitMargin + product.price) *
            currentDependency?.quantity;
        });
        console.log(finalPrice);
      }
      // prepare data ensuring Tags uses Prisma connect syntax

      const mapping = productCreateMapping;
      const finalQuery = prismaCreateEntityBuilder(createData, mapping);
      const data: any = {
        ...finalQuery,
        price: finalPrice,
      };
      if (createData.isComponentOf && createData.isComponentOf.length > 0) {
        if (createData.isComponentOf.length)
          data.isComponentOf = {
            create: createData.isComponentOf.map(
              (component: any) =>
                ({
                  productId: component.id,
                  quantity: component.quantity,
                } as any)
            ),
          };
      }

      console.log(data);
      const product = await this.prisma.product.create({
        data,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          active: true,
          Tags: true,
          Category: true,
          Brand: true,
          isComponentOf: finalPrice != createData.price,
        },
      });
      return new BaseResponse(200, "Producto creado correctamente", product);
    } catch (error) {
      throw new AppError(ErrorsEnum.SERVER_ERROR);
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
          price: true,
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
          price: true,
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
}
