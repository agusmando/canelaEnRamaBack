import { CreateProductDto } from './../dto/products/create-product.dto.ts';
import { GetProductsDto } from './../dto/products/get-products.dto.ts';
import { ProductDto } from '../dto/products/product.dto.ts';
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { prismaQueryBuilder } from './../utils/prismaQueryBuilder.ts';
import { productQueryMapping } from '../mappings/product.mapping.ts';
import { UpdateProductDto } from '../dto/products/update-product.dto.ts';
import { UpdateProductTagDto } from '../dto/products/update-product-tag.dto.ts';

export class ProductService {
  private prisma: PrismaClient;
  //private searchCriteriaHandler: SearchCriteriaHandler;
  constructor(
  ) {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
  
  getPaginatedProducts: (
    receivedDto: GetProductsDto[],
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ) => Promise<PaginatedResponse<ProductDto>> = async (  
    receivedDto: GetProductsDto[],
    currentPage: number,
    amountPerPage: number,
    detalle: boolean = false
  ) => {
    const where = prismaQueryBuilder(receivedDto, productQueryMapping); 
    const skip = (currentPage - 1) * amountPerPage
    const take = amountPerPage;
    console.log("Where clause:", where)
    let totalElements, products ;
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
      console.log("Total elements:", totalElements, products);
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
      products as ProductDto[],
      currentPage,
      amountPerPage,
      totalElements
    );
  };

  createProduct: (productData: CreateProductDto) => Promise<BaseResponse<ProductDto>> = async (
    productData: CreateProductDto
  ) => {
    try {
      const newProduct = await this.prisma.product.create({
        data: {
          ...productData,
          Tags: {
            connect: productData.Tags?.map((tag: any) => ({id: tag.id })),
          }
        }
      });
      return new BaseResponse(201, "Producto creado con éxito", newProduct);
    } catch (error) {
      console.error("Error creating product:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  };

  getOneProduct: (productId: number) => Promise<BaseResponse<ProductDto>> = async (
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

  updateProduct: (productId: number, productData: UpdateProductDto) => Promise<BaseResponse<ProductDto>> = async (
    productId: number, 
    productData: UpdateProductDto
  ) => {
    try {
      const updatedProduct = await this.prisma.product.update({
        where: { id: Number(productId) },
        data: ({ 
          ...productData,
          Tags: {
            connect: productData.tags?.map((tag: any) => ({id: tag.id })),
          }
        } as any),
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          active: true,
          Tags: true,
          Category: true,
          Supplier: true  
        }
      });
      return new BaseResponse(200, "Producto editado correctamente", updatedProduct);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  addProductTags: (productId: number, tagData: UpdateProductTagDto) => Promise<BaseResponse<ProductDto>> = async (
    productId: number, 
    tagData: UpdateProductTagDto
  ) => {
    try {
      console.log(tagData);
      const updatedProduct = await this.prisma.product.update({
        where: { id: Number(productId) },
        data: ({
          Tags: {
            connect: tagData.tagsId.map((tagId: any) => ({ id: tagId.id })),
          }
        } as any),
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          active: true,
          Tags: true,
          Category: true,
          Supplier: true  
        }
      });
      return new BaseResponse(200, "Producto editado correctamente", updatedProduct);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
  
  removeProductTags: (productId: number, tagData: UpdateProductTagDto) => Promise<BaseResponse<ProductDto>> = async (
    productId: number, 
    tagData: UpdateProductTagDto
  ) => {
    try {
      const updatedProduct = await this.prisma.product.update({
        where: { id: Number(productId) },
        data: ({ 
          Tags: {
            disconnect: tagData.tagsId.map((tag: any) => ({id: tag.id })),
          }
        } as any),
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          active: true,
          Tags: true,
          Category: true,
          Supplier: true  
        }
      });
      return new BaseResponse(200, "Producto editado correctamente", updatedProduct);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  deactivateProduct: (productId: number) => Promise<BaseResponse<{}>> = async (
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
  
  activateProduct: (productId: number) => Promise<BaseResponse<{}>> = async (
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
