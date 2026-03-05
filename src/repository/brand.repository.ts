import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.js";  
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.js";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.js";
import { BrandDto } from "../dto/brand/brand.dto.js";
import { ProductRepository } from "./product.repository.js";
import { UpdateBrandProductDto } from "../dto/brand/update-brand-product.dto.js";

export class BrandRepository extends GenericRepositoryImpl<
  BrandDto,
  CreateBrandDto,
  UpdateBrandDto
> {
  protected prisma: PrismaClient;
  protected productRepository: ProductRepository;
  // protected imageService: ImageService;
  constructor() {
    super("product");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.productRepository = new ProductRepository();
    // this.imageService = new ImageService();
  }

  async addRemoveProducts(
    brandId: number,
    productData: UpdateBrandProductDto,
    addingProduct: boolean,
    tx?: PrismaClient
  ): Promise<any> {
    let data = {
      products: {
        [addingProduct ? "connect" : "disconnect"]: productData.productsId.map(
          (productId: any) => ({ id: productId.id })
        ),
      },
    };

    const model = tx ?? this.prisma;
    console.log(JSON.stringify(data));
    return await model.brand.update({
      where: { id: brandId },
      data,
      include: {
        products: true,
        suppliers: true,
      },
    });
  }
}
