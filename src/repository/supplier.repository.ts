import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { SupplierDto } from "../dto/supplier/supplier.dto.ts";
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.ts";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.ts";
import { UpdateSupplierBrandDto } from "../dto/supplier/update-supplier-brand.dto.ts";
export class SupplierRepository extends GenericRepositoryImpl<
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto
> {
  protected prisma: PrismaClient;
  // protected imageService: ImageService;
  constructor() {
    super("supplier");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async addRemoveBrands(
    supplierId: number,
    brandData: UpdateSupplierBrandDto,
    addingBrand: boolean,
    tx?: PrismaClient
  ): Promise<any> {
    let data = {
      brands: {
        [addingBrand ? "connect" : "disconnect"]: brandData.brandsId.map(
          (brands: any) => ({ id: brands.id })
        ),
      },
    };

    const model = tx ?? this.prisma;
    console.log(JSON.stringify(data));
    return await model.supplier.update({
      where: { id: supplierId },
      data,
      include: {
        brands: true,
      },
    });
  }
}
