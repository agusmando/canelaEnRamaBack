import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";

import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";

export class ProductService {
  private prisma: PrismaClient;
  constructor(
  ) {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
  
  getPaginatedProducts: (
    multipleReqParams: { searchCriteria: string, searchValue: string}[],
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ) => Promise<PaginatedResponse<any>> = async (
    value: string,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean = false
  ) => {
    const where = {
      name: {
        contains: value,
      },
    }, 
    skip = (currentPage - 1) * amountPerPage,
    take = amountPerPage;
    let totalElements, products;
    try {
      [totalElements, products] = await Promise.all([
        this.prisma.product.count({
          where,
        }),
        this.prisma.product.findMany({
          where,
          skip,
          take,
          select: !detalle ? undefined : {
            id: true,
            name: true,
            description: true,
            price: true,
            active: true,
            Category: true,
            Supplier: true,
            Tags:  true,
          },
        }),
      ]);
    } catch (error) {
      console.error("Error fetching products:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (totalElements === 0 || products.length === 0) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    return new PaginatedResponse(
      200,
      "Productos obtenidos con éxito",
      products,
      currentPage,
      amountPerPage,
      totalElements
    );
  };

  createProduct: (productData: any) => Promise<BaseResponse<any>> = async (
    productData: any
  ) => {
    try {
      const newProduct = await this.prisma.product.create({
        data: {
          ...productData,
          Tags: {
            connect: productData.Tags.map((tag: any) => ({id: tag.id })),
          }
        }
      });
      return new BaseResponse(201, "Producto creado con éxito", newProduct);
    } catch (error) {
      console.error("Error creating product:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  };

  getOneProduct: (productId: number) => Promise<BaseResponse<any>> = async (
    productId: number
  ) => {
    let product;
    try {
      product = await this.prisma.product.findFirst({
        where: { id: Number(productId) },
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (!product) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    return new BaseResponse(200, "Producto obtenido con éxito", product);
  };

  deactivateProduct: (productId: number) => Promise<BaseResponse<any>> = async (
    productId: number
  ) => {
    try {
      await this.prisma.product.update({
        where: { id: Number(productId) },
        data: ({ active: false } as any),
      });
      return new BaseResponse(200, "Producto dado de baja correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
  activateProduct: (productId: number) => Promise<BaseResponse<any>> = async (
    productId: number
  ) => {
    try {
      await this.prisma.product.update({
        where: { id: Number(productId) },
        data: ({ active: true } as any),
      });
      return new BaseResponse(200, "Producto activado correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
}
