import { BaseResponse, PaginatedResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { UpdateSupplierBrandDto } from "../dto/supplier/update-supplier-brand.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { SupplierDto } from "../dto/supplier/supplier.dto.ts";
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.ts";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { SupplierRepository } from "../repository/supplier.repository.ts";

export class SupplierService extends GenericServiceImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  protected supplierRepository: SupplierRepository;

  constructor() {
    super("supplier");
    this.supplierRepository = new SupplierRepository();
  }

  async addRemoveBrands(
    supplierId: number,
    brandData: UpdateSupplierBrandDto,
    addingBrand: boolean,
  ): Promise<SupplierDto> {
    if (!supplierId || supplierId == 0) {
      throw new NotFoundError();
    }
    if (!brandData.brandsId || brandData.brandsId.length == 0) {
      throw new ValidationError(
        "Brand ids are required for adding brands to supplier",
      );
    }

    return this.supplierRepository.withTransaction(async (tx) => {
      return await this.supplierRepository.addRemoveBrands(
        Number(supplierId),
        brandData,
        addingBrand,
        tx,
      );
    });
  }
}
