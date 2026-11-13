import { GenericRepositoryImpl } from "./generic.repository.js";
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.js";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.js";
import { BrandDto } from "../dto/brand/brand.dto.js";
import { UpdateBrandProductDto } from "../dto/brand/update-brand-product.dto.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

export class BrandRepository extends GenericRepositoryImpl<BrandDto, CreateBrandDto, UpdateBrandDto> {
  constructor() {
    super("brand"); // antes era "product" por error
  }

  async addRemoveProducts(
    brandId: number,
    productData: UpdateBrandProductDto,
    addingProduct: boolean,
    tx?: any,
  ): Promise<any> {
    try {
      return await (tx ?? this.prisma).brand.update({
        where: { id: brandId },
        data: {
          products: {
            [addingProduct ? "connect" : "disconnect"]: productData.productsId.map((p: any) => ({
              id: Number(p?.id ?? p),
            })),
          },
        },
        include: { products: true, suppliers: true },
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }
}
