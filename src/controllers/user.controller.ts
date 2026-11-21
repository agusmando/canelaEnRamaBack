import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { primaryRole } from "../config/rbac.js";
import { UserService } from "../services/user.service.js";

export class UserController {
  constructor(protected readonly userService = new UserService()) {}

  /** GET /user/me — incluye roles y permisos para que el dashboard arme el menú. */
  async getMe(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const user = await this.userService.findOneBySupertokensId(actor.userId!);
      if (!user) throw new NotFoundError("User not found");
      res.status(200).json(
        new BaseResponse(200, "User found", {
          ...user,
          role: primaryRole(actor.roles) ?? "CONSUMER",
          roles: actor.roles,
          permissions: actor.permissions,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /** GET /user/:supertokensId — el propio usuario o quien administra usuarios. */
  async getOneBySupertokensId(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const supertokensId = req.params.supertokensId;
      if (!actor.permissions.includes("users.manage") && actor.userId !== supertokensId) {
        throw new NotFoundError("User not found");
      }
      const user = await this.userService.findOneBySupertokensId(supertokensId);
      if (!user) throw new NotFoundError("User not found");
      res.status(200).json(new BaseResponse(200, "User found", user));
    } catch (error) {
      next(error);
    }
  }

  /** GET /user?search=&role=&currentPage=&amountPerPage= */
  async list(req: any, res: any, next: any) {
    try {
      const { content, page, perPage, total, counts } = await this.userService.list({
        search: req.query.search,
        role: req.query.role,
        page: req.query.currentPage,
        perPage: req.query.amountPerPage,
      });
      res.status(200).json(
        new BaseResponse(200, "Usuarios", {
          content,
          pagination: { page, amountPerPage: perPage, totalAmount: total },
          counts,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  roles(_req: any, res: any) {
    res.status(200).json(new BaseResponse(200, "Roles", this.userService.roleCatalog()));
  }

  async detail(req: any, res: any, next: any) {
    try {
      res.status(200).json(
        new BaseResponse(200, "Usuario", await this.userService.detail(req.params.supertokensId)),
      );
    } catch (error) {
      next(error);
    }
  }

  async setRole(req: any, res: any, next: any) {
    try {
      const user = await this.userService.setRole(
        getActor(req),
        req.params.supertokensId,
        req.body?.role ?? null,
      );
      res.status(200).json(new BaseResponse(200, "Rol actualizado", user));
    } catch (error) {
      next(error);
    }
  }

  async revokeSessions(req: any, res: any, next: any) {
    try {
      const result = await this.userService.revokeSessions(getActor(req), req.params.supertokensId);
      res.status(200).json(new BaseResponse(200, "Sesiones cerradas", result));
    } catch (error) {
      next(error);
    }
  }

  async invite(req: any, res: any, next: any) {
    try {
      const result = await this.userService.invite(getActor(req), req.body ?? {});
      const status = result.created ? 201 : 200;
      res.status(status).json(new BaseResponse(status, "Invitación lista", result));
    } catch (error) {
      next(error);
    }
  }
}
