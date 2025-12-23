import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { UpdateSupplierBrandDto } from "../dto/supplier/update-supplier-brand.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { SupplierDto } from "../dto/supplier/supplier.dto.ts";
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.ts";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.ts";

export class SupplierService extends GenericServiceImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  protected prisma: PrismaClient;

  constructor() {
    super("supplier");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  addSupplierBrands: (
    supplierId: number,
    brandData: UpdateSupplierBrandDto
  ) => Promise<BaseResponse<SupplierDto>> = async (
    supplierId: number,
    brandData: UpdateSupplierBrandDto
  ) => {
    try {
      const updatedSupplier = await this.prisma.supplier.update({
        where: { id: Number(supplierId) },
        data: {
          brands: {
            connect: brandData.brandsId.map((brandId: any) => ({
              id: brandId.id,
            })),
          },
        } as any,
        select: {
          id: true,
          name: true,
          contact: true,
          description: true,
          brands: true,
        },
      });
      return new BaseResponse(
        200,
        "Proveedor editado correctamente",
        updatedSupplier
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  removeSupplierBrand: (
    supplierId: number,
    brandData: UpdateSupplierBrandDto
  ) => Promise<BaseResponse<SupplierDto>> = async (
    supplierId: number,
    brandData: UpdateSupplierBrandDto
  ) => {
    try {
      const updatedSupplier = await this.prisma.supplier.update({
        where: { id: Number(supplierId) },
        data: {
          brands: {
            disconnect: brandData.brandsId.map((brand: any) => ({
              id: brand.id,
            })),
          },
        } as any,
        select: {
          id: true,
          name: true,
          contact: true,
          description: true,
          brands: true,
        },
      });
      return new BaseResponse(
        200,
        "Proveedor editado correctamente",
        updatedSupplier
      );
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
}
