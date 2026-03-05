import { PrismaClient } from "@prisma/client/extension";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { UserDto } from "../dto/user/user.dto.js";

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
}
