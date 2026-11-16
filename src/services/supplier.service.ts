import { UpdateSupplierBrandDto } from "../dto/supplier/update-supplier-brand.dto.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { SupplierDto } from "../dto/supplier/supplier.dto.js";
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.js";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { SupplierRepository } from "../repository/supplier.repository.js";

export class SupplierService extends GenericServiceImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  constructor(protected readonly supplierRepository = new SupplierRepository()) {
    super(supplierRepository);
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

    return this.supplierRepository.addRemoveBrands(Number(supplierId), brandData, addingBrand);
  }
}
