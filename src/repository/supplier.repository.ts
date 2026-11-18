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

  async findWithBrands(id: number): Promise<any> {
    try {
      return await this.prisma.supplier.findUnique({ where: { id }, include: { brands: { select: { id: true } } } });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  /** Saca las marcas de un proveedor y se las asigna a otro, en una sola transacción. */
  async transferBrands(fromSupplierId: number, toSupplierId: number, brandIds: number[]): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const ids = brandIds.map((id) => ({ id }));
        await tx.supplier.update({ where: { id: fromSupplierId }, data: { brands: { disconnect: ids } } });
        await tx.supplier.update({ where: { id: toSupplierId }, data: { brands: { connect: ids } } });
        return tx.supplier.findUnique({ where: { id: fromSupplierId }, include: { brands: true } });
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }
}
