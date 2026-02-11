import { UpdateBrandProductDto } from "../dto/brand/update-brand-product.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { BrandDto } from "../dto/brand/brand.dto.ts";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.ts";
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { BrandRepository } from "../repository/brand.repository.ts";

export class BrandService extends GenericServiceImpl<
  BrandDto,
  CreateBrandDto,
  UpdateBrandDto
> {
  protected brandRepository: BrandRepository;
  constructor() {
    super("brand");
    this.brandRepository = new BrandRepository();
  }

  async addRemoveProducts(
    brandId: number,
    productData: UpdateBrandProductDto,
    addingProduct: boolean
  ): Promise<BrandDto> {
    if (!brandId || brandId == 0) {
      throw new NotFoundError();
    }
    if (!productData.productsId || productData.productsId.length == 0) {
      throw new ValidationError("Product ids are required for adding products to brand");
    }
    return this.brandRepository.withTransaction(async (tx) => {
      return await this.brandRepository.addRemoveProducts(
        Number(brandId),
        productData,
        addingProduct,
        tx
      );
    }); 
  }
}
