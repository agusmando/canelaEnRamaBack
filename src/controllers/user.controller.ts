import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { STAFF_ROLES, primaryStaffRole, type StaffRole } from "../config/rbac.js";
import { UserService } from "../services/user.service.js";

export class UserController {
  constructor(protected readonly userService = new UserService()) {}

  /** GET /user/me */
  async getMe(req: any, res: any, next: any) {
    try {
      const actor = getActor(req);
      const user = await this.userService.findOneBySupertokensId(actor.userId!);
      if (!user) throw new NotFoundError("User not found");
      res.status(200).json(
        new BaseResponse(200, "User found", {
          ...user,
          role: primaryStaffRole(actor.roles) ?? "CONSUMER",
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

  /** GET /user — listado paginado para gestión. */
  async findAll(req: any, res: any, next: any) {
    try {
      const allowedRoles = ["STAFF", "ADMIN", "EDITOR", "EMPLOYEE", "CUSTOMER"];
      const role = req.query.role as string | undefined;
      if (role && !allowedRoles.includes(role)) throw new ValidationError("Filtro de rol inválido");
      const result = await this.userService.list(
        Number(req.query.currentPage ?? 1),
        Number(req.query.amountPerPage ?? 20),
        typeof req.query.search === "string" ? req.query.search : "",
        role as "STAFF" | "ADMIN" | "EDITOR" | "EMPLOYEE" | "CUSTOMER" | undefined,
      );
      res.status(200).json(new BaseResponse(200, "Users obtained successfully", result));
    } catch (error) {
      next(error);
    }
  }

  /** GET /user/roles — roles de staff y permisos efectivos. */
  async findRoles(_req: any, res: any, next: any) {
    try {
      const roles = await this.userService.listRoles();
      res.status(200).json(new BaseResponse(200, "Roles obtained successfully", roles));
    } catch (error) {
      next(error);
    }
  }

  async detail(req: any, res: any, next: any) {
    try {
      const user = await this.userService.detail(req.params.supertokensId);
      res.status(200).json(new BaseResponse(200, "User found", user));
    } catch (error) {
      next(error);
    }
  }

  async setRole(req: any, res: any, next: any) {
    try {
      const role = req.body?.role;
      if (role !== null && (typeof role !== "string" || !STAFF_ROLES.includes(role as StaffRole))) {
        throw new ValidationError("role debe ser ADMIN, EDITOR, EMPLOYEE o null");
      }
      const actorId = getActor(req).userId;
      if (!actorId) throw new NotFoundError("User not found");
      const user = await this.userService.setRole(req.params.supertokensId, role as StaffRole | null, actorId);
      res.status(200).json(new BaseResponse(200, "User role updated", user));
    } catch (error) {
      next(error);
    }
  }

  async revokeSessions(req: any, res: any, next: any) {
    try {
      const result = await this.userService.revokeSessions(req.params.supertokensId);
      res.status(200).json(new BaseResponse(200, "User sessions revoked", result));
    } catch (error) {
      next(error);
    }
  }

  async invite(req: any, res: any, next: any) {
    try {
      const result = await this.userService.invite(req.body ?? {});
      res.status(201).json(new BaseResponse(201, "User invitation created", result));
    } catch (error) {
      next(error);
    }
  }
}
