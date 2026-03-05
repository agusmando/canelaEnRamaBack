import { UpdateBrandProductDto } from "../dto/brand/update-brand-product.dto.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { BrandDto } from "../dto/brand/brand.dto.js";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.js";
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { BrandRepository } from "../repository/brand.repository.js";

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
