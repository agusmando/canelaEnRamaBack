import { UserService } from "../services/user.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";

export class UserController {
  constructor(protected readonly userService = new UserService()) {}

  /** GET /user/me — incluye roles y permisos (el dashboard arma el menú con eso). */
  async getMe(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const user = await this.userService.findOneBySupertokensId(actor.userId!);
      if (!user) throw new NotFoundError("User not found");
      res
        .status(200)
        .json(new BaseResponse(200, "User found", { ...user, roles: actor.roles, permissions: actor.permissions }));
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

  // ------------------------------------------------------------ Gestión (users.manage)

  /** GET /user?search=&role=ADMIN|EDITOR|EMPLOYEE|CUSTOMER|STAFF&currentPage=&amountPerPage= */
  async list(req: any, res: any, next: any) {
    try {
      const { content, page, perPage, total, counts } = await this.userService.list({
        search: req.query.search,
        role: req.query.role,
        page: req.query.currentPage,
        perPage: req.query.amountPerPage,
      });
      res.status(200).json(
        new BaseResponse(200, "Usuarios", { content, pagination: { page, amountPerPage: perPage, totalAmount: total }, counts }),
      );
    } catch (error) {
      next(error);
    }
  }

  /** GET /user/roles */
  roles(_req: any, res: any) {
    res.status(200).json(new BaseResponse(200, "Roles", this.userService.roleCatalog()));
  }

  /** GET /user/:supertokensId/detail */
  async detail(req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Usuario", await this.userService.detail(req.params.supertokensId)));
    } catch (error) {
      next(error);
    }
  }

  /** PUT /user/:supertokensId/role { role: "ADMIN" | "EDITOR" | "EMPLOYEE" | null } */
  async setRole(req: any, res: any, next: any) {
    try {
      const user = await this.userService.setRole(getActor(req), req.params.supertokensId, req.body?.role ?? null);
      res.status(200).json(new BaseResponse(200, "Rol actualizado", user));
    } catch (error) {
      next(error);
    }
  }

  /** POST /user/:supertokensId/revoke-sessions */
  async revokeSessions(req: any, res: any, next: any) {
    try {
      const result = await this.userService.revokeSessions(getActor(req), req.params.supertokensId);
      res.status(200).json(new BaseResponse(200, "Sesiones cerradas", result));
    } catch (error) {
      next(error);
    }
  }

  /** POST /user/invite { email, name?, role } */
  async invite(req: any, res: any, next: any) {
    try {
      const result = await this.userService.invite(getActor(req), req.body ?? {});
      res.status(result.created ? 201 : 200).json(new BaseResponse(result.created ? 201 : 200, "Invitación lista", result));
    } catch (error) {
      next(error);
    }
  }
}
