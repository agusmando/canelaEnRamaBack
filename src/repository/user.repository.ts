import { GenericRepositoryImpl } from "./generic.repository.js";
import { UserDto } from "../dto/user/user.dto.js";

export class UserRepository extends GenericRepositoryImpl<UserDto, UserDto, UserDto> {
  constructor() {
    super("user");
  }

  async findOneBySupertokensId(supertokensId: string) {
    return this.prisma.user.findUnique({ where: { supertokensId } });
  }
}
