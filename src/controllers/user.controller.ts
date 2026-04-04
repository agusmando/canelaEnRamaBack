// import { CreateUserDto } from "../dto/movement/create-movement.dto.js";
import { UserDto } from "../dto/user/user.dto.js";
import { UserService } from "../services/user.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

export class UserController extends GenericControllerImpl<
  UserDto,
  UserDto,
  UserDto
> {
  protected userService: UserService;
  constructor() {
    super("user");
    this.userService = new UserService();
  }

  async getOneBySupertokensId(req: any, res: any, next: any) {
    try {
      const supertokensId = req.params.supertokensId;
      const user = await this.userService.findOneBySupertokensId(supertokensId);
      if (user) {
        res.status(200).json(new BaseResponse(200, "User found", user));
      } else {
        res.status(404).json(new BaseResponse(404, "User not found"));
      }
    } catch (error) {
      next(error);
    }
  }
}
