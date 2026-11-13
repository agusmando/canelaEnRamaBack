import { UserService } from "../services/user.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";

export class UserController {
  constructor(protected readonly userService = new UserService()) {}

  /** GET /user/me */
  async getMe(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const user = await this.userService.findOneBySupertokensId(actor.userId!);
      if (!user) throw new NotFoundError("User not found");
      res.status(200).json(new BaseResponse(200, "User found", { ...user, roles: actor.roles }));
    } catch (error) {
      next(error);
    }
  }

  /** GET /user/:supertokensId — el propio usuario o staff. */
  async getOneBySupertokensId(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const supertokensId = req.params.supertokensId;
      if (!actor.isStaff && actor.userId !== supertokensId) {
        throw new NotFoundError("User not found");
      }
      const user = await this.userService.findOneBySupertokensId(supertokensId);
      if (!user) throw new NotFoundError("User not found");
      res.status(200).json(new BaseResponse(200, "User found", user));
    } catch (error) {
      next(error);
    }
  }
}
