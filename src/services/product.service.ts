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
      let finalStock = createData.currentStock || 0;
      if (createData.hasComponents) {
        if (!["G", "U"].includes(createData.measure)) {
          throw new AppError(ErrorsEnum.INVALID_MEASURE);
        }
        const mixStatus = await this.handleMixCreation(
          createData.hasComponents,
          createData.measure,
          createData.currentStock
        );
        finalPrice = mixStatus.finalPrice;
        finalStock = mixStatus.finalStock;
      }
      // prepare data ensuring Tags uses Prisma connect syntax

      const mapping = productCreateMapping;
      const finalQuery = prismaCreateEntityBuilder(createData, mapping);
      const data: any = {
        ...finalQuery,
        price: finalPrice,
        currentStock: finalStock,
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
          isComponentOf: { include: { mixProduct: true } },
          hasComponents: { include: { componentProduct: true } },
        },
      });
      return new BaseResponse(200, "Producto creado correctamente", product);
    } catch (error) {
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  }

  async update(
    id: number,
    data: UpdateProductDto
  ): Promise<BaseResponse<ProductDto>> {
    try {
      if (data.addComponents && data.addComponents.length > 0) {
        console.log(data.addComponents);
        const componentPromises = data.addComponents.map((component: any) => {
          return this.prisma.$executeRaw`
            SELECT public.add_component_to_product(${component.productId}::INT, ${id}::INT, ${component.quantity}::INT)
        `;
        });
        await Promise.all(componentPromises);
        await this.prisma
          .$executeRaw`SELECT public.recalculate_mix_price(${id}::INT)`;
      }

      if (data.editComponents && data.editComponents.length > 0) {
        const componentPromises = data.editComponents.map((component: any) => {
          return this.prisma.dependency.update({
            where: {
              mixId_productId: {
                mixId: Number(id),
                productId: Number(component.productId),
              },
            },
            data: {
              quantity: component.quantity,
            },
          });
        });
        await Promise.all(componentPromises);
        await this.prisma
          .$executeRaw`SELECT public.recalculate_mix_price(${id}::INT)`;
      }

      if (data.removeComponents && data.removeComponents.length > 0) {
        const componentPromises = data.removeComponents.map(
          (component: any) => {
            return this.prisma.dependency.delete({
              where: {
                mixId_productId: {
                  mixId: Number(id),
                  productId: Number(component.productId),
                },
              },
            });
          }
        );
        await Promise.all(componentPromises);
        await this.prisma
          .$executeRaw`SELECT public.recalculate_mix_price(${id}::INT)`;
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
            price: true,
            active: true,
            Tags: true,
            Category: true,
            Brand: true,
            isComponentOf: { include: { mixProduct: true } },
            hasComponents: { include: { componentProduct: true } },
          },
        });
        return new BaseResponse(
          200,
          "Entidad editada correctamente",
          updatedProduct as any
        );
      } else {
        updatedProduct = await this.prisma.product.update({
          where: { id: Number(id) },
          data: updateData,
        });
      }
      //Post processing mapping
      if (postMapping && updatedProduct) {
        (updatedProduct as any) = postMapping(updatedProduct as any);
      }

      console.log(data);

      if (data.price || data.profitMargin) {
        await this.prisma
          .$executeRaw`SELECT public.recalculate_all_mixes_from_product(${id}::INT)`;
      }

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
          price: true,
          active: true,
          Tags: true,
          Category: true,
          Brand: true,
          isComponentOf: { include: { mixProduct: true } },
          hasComponents: { include: { componentProduct: true } },
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
          isComponentOf: { include: { mixProduct: true } },
          hasComponents: { include: { componentProduct: true } },
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
      foundProducts = await this.prisma.product.findMany({
        where: {
          id: {
            in: containingProductIds,
          },
        },
        select: {
          id: true,
          price: true,
          profitMargin: true,
          measure: true,
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
      if ()
      // if (measure === "G") {
      //   if (product.measure !== "G") {
      //     throw new AppError(ErrorsEnum.INVALID_MEASURE);
      //   }
      //   stock += currentDependency?.quantity || 0;
      // }
      if (measure === "U") {
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

    if (measure === "G") {
      finalStock = sugestedStock;
    }
    if (measure === "U") {
      finalStock = Math.min(...(stockForUnit || []));
    }
    console.log("finalStock", finalStock);
    return { finalPrice, finalStock };
  }
}
