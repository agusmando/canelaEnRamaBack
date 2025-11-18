import { CreateProductDto } from './../dto/products/create-product.dto.ts';
import { GetProductsDto } from './../dto/products/get-products.dto.ts';
import { ProductDto } from '../dto/products/product.dto.ts';
import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { UpdateProductDto } from '../dto/products/update-product.dto.ts';
import { UpdateProductTagDto } from '../dto/products/update-product-tag.dto.ts';
import { GenericServiceImpl } from './generic-impl.service.ts';

export class ProductService extends GenericServiceImpl<ProductDto, CreateProductDto, UpdateProductDto> {
  protected prisma: PrismaClient;

  constructor() {
    super('product');
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

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
}