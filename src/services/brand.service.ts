import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { UpdateBrandProductDto } from "../dto/brand/update-brand-product.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { BrandDto } from "../dto/brand/brand.dto.ts";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.ts";
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.ts";

export class BrandService extends GenericServiceImpl<
  BrandDto,
  CreateBrandDto,
  UpdateBrandDto
> {
  protected prisma: PrismaClient;

  constructor() {
    super("product");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  addBrandProducts: (
    brandId: number,
    productData: UpdateBrandProductDto
  ) => Promise<BaseResponse<BrandDto>> = async (
    brandId: number,
    productData: UpdateBrandProductDto
  ) => {
    try {
      console.log(productData);
      const updatedBrand = await this.prisma.brand.update({
        where: { id: Number(brandId) },
        data: {
          products: {
            connect: productData.productsId.map((productId: any) => ({
              id: productId.id,
            })),
          },
        } as any,
        select: {
          id: true,
          name: true,
          description: true,
          products: true,
          suppliers: true,
        },
      });
      return new BaseResponse(200, "Marca editada correctamente", updatedBrand);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  removeBrandProduct: (
    brandId: number,
    productData: UpdateBrandProductDto
  ) => Promise<BaseResponse<BrandDto>> = async (
    brandId: number,
    productData: UpdateBrandProductDto
  ) => {
    try {
      const updatedBrand = await this.prisma.brand.update({
        where: { id: Number(brandId) },
        data: {
          products: {
            disconnect: productData.productsId.map((product: any) => ({
              id: product.id,
            })),
          },
        } as any,
        select: {
          id: true,
          name: true,
          description: true,
          products: true,
          suppliers: true,
        },
      });
      return new BaseResponse(200, "Marca editada correctamente", updatedBrand);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
}
