import { PrismaClient } from "@prisma/client";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { UserDto } from "../dto/user/user.dto.js";

export class UserRepository extends GenericRepositoryImpl<
  UserDto,
  UserDto,
  UserDto
> {
  protected prisma: PrismaClient;
  constructor() {
    super("user");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async findOneBySupertokensId(supertokensId: string) {
    console.log(supertokensId)
    return await this.prisma.user.findUnique({
      where: {
        supertokensId: supertokensId,
      },
    });
  }
}
