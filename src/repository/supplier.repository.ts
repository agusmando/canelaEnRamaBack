import { GenericRepositoryImpl } from "./generic.repository.js";
import { SupplierDto } from "../dto/supplier/supplier.dto.js";
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.js";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.js";
import { UpdateSupplierBrandDto } from "../dto/supplier/update-supplier-brand.dto.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

export class SupplierRepository extends GenericRepositoryImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  constructor() {
    super("supplier");
  }

  async addRemoveBrands(
    supplierId: number,
    brandData: UpdateSupplierBrandDto,
    addingBrand: boolean,
    tx?: any,
  ): Promise<any> {
    try {
      return await (tx ?? this.prisma).supplier.update({
        where: { id: supplierId },
        data: {
          brands: {
            [addingBrand ? "connect" : "disconnect"]: brandData.brandsId.map((b: any) => ({
              id: Number(b?.id ?? b),
            })),
          },
        },
        include: { brands: true },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }
}
