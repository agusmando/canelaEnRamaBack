import { GenericRepositoryImpl } from "./generic.repository.js";
import { UserDto } from "../dto/user/user.dto.js";

export class UserRepository extends GenericRepositoryImpl<UserDto, UserDto, UserDto> {
  constructor() {
    super("user");
  }

  async list(page = 1, amountPerPage = 20) {
    const currentPage = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(amountPerPage) || 20));
    const [totalElements, entityList] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { id: "desc" },
        take: perPage,
        skip: (currentPage - 1) * perPage,
      }),
    ]);
    return { entityList, totalElements, currentPage, amountPerPage: perPage };
  }

  async findOneBySupertokensId(supertokensId: string) {
    return this.prisma.user.findUnique({ where: { supertokensId } });
  }
}
