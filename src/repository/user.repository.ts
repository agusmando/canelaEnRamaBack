import { PrismaClient } from "@prisma/client/extension";
import { GenericRepositoryImpl } from "./generic.repository.ts";
import { UserDto } from "../dto/user/user.dto.ts";

export class UserRepository extends GenericRepositoryImpl<
  UserDto,
  UserDto,
  UserDto
> {
  protected prisma: PrismaClient;
  // protected imageService: ImageService;
  constructor() {
    super("user");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  //   async addRemoveBrands(
  //     supplierId: number,
  //     brandData: UpdateCartBrandDto,
  //     addingBrand: boolean
  //   ): Promise<any> {
  //     let data = {
  //       brands: {
  //         [addingBrand ? "connect" : "disconnect"]: brandData.brandsId.map(
  //           (brands: any) => ({ id: brands.id })
  //         ),
  //       },
  //     };
  //     console.log(JSON.stringify(data));
  //     return await this.prisma.supplier.update({
  //       where: { id: supplierId },
  //       data,
  //       include: {
  //         brands: true,
  //       },
  //     });
  //   }
}
