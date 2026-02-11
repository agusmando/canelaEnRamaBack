import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.ts";  
import { UpdateBrandDto } from "../dto/brand/update-brand.dto.ts";
import { CreateBrandDto } from "../dto/brand/create-brand.dto.ts";
import { BrandDto } from "../dto/brand/brand.dto.ts";
import { ProductRepository } from "./product.repository.ts";
import { UpdateBrandProductDto } from "../dto/brand/update-brand-product.dto.ts";

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
    console.log(JSON.stringify(data));
    return await this.prisma.brand.update({
      where: { id: brandId },
      data,
      include: {
        products: true,
        suppliers: true,
      },
    }, tx);
  }
}
