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

  /** Pasa marcas de este proveedor a otro (p. ej. porque cobra menos). */
  async transferBrands(
    supplierId: number,
    body: { brandsId?: ({ id: number } | number)[]; toSupplierId?: number },
  ): Promise<SupplierDto> {
    const toSupplierId = Number(body?.toSupplierId);
    if (!supplierId) throw new NotFoundError();
    if (!toSupplierId) throw new ValidationError("toSupplierId es obligatorio");
    if (toSupplierId === supplierId) {
      throw new ValidationError("Elegí un proveedor distinto al actual");
    }
    const brandIds = (body?.brandsId ?? [])
      .map((b: any) => Number(b?.id ?? b))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!brandIds.length) throw new ValidationError("Elegí al menos una marca para pasar");

    const [from, to]: any[] = await Promise.all([
      this.supplierRepository.findWithBrands(supplierId),
      this.supplierRepository.findWithBrands(toSupplierId),
    ]);
    if (!from) throw new NotFoundError("Proveedor no encontrado");
    if (!to) throw new NotFoundError("Proveedor destino no encontrado");
    const owned = new Set((from.brands ?? []).map((b: any) => b.id));
    const foreign = brandIds.filter((id) => !owned.has(id));
    if (foreign.length) {
      throw new ValidationError(`El proveedor no distribuye las marcas ${foreign.join(", ")}`);
    }
    return this.supplierRepository.transferBrands(supplierId, toSupplierId, brandIds);
  }
}
