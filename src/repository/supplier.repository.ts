import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { SupplierDto } from "../dto/supplier/supplier.dto.js";
import { CreateSupplierDto } from "../dto/supplier/create-supplier.dto.js";
import { UpdateSupplierDto } from "../dto/supplier/update-supplier.dto.js";
import { UpdateSupplierBrandDto } from "../dto/supplier/update-supplier-brand.dto.js";
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
