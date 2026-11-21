import { verifySession } from "supertokens-node/recipe/session/framework/express";
import UserRoles from "supertokens-node/recipe/userroles";
import { BaseResponse } from "../utils/responseFormat.js";
import { permissionsForRoles, STAFF_ROLES, type Permission } from "../config/rbac.js";

/** Quién hace el request, para reglas de ownership en los servicios. */
export type Actor = { userId?: string; roles: string[]; permissions: Permission[]; isStaff: boolean };

// 1. Middleware básico para verificar que está logueado
export const isAuthenticated = verifySession();

// Sesión opcional: invitados pasan sin sesión (carrito de invitado)
export const optionalSession = verifySession({ sessionRequired: false });

const loadRoles = async (req: any): Promise<string[]> => {
  if (!req.session) return [];
  if (req.userRoles) return req.userRoles;
  const { roles } = await UserRoles.getRolesForUser(
    req.session.getTenantId(),
    req.session.getUserId(),
  );
  req.userRoles = roles;
  return roles;
};

/** Carga los roles (si hay sesión) sin exigir ninguno. */
export const attachRoles = async (req: any, _res: any, next: any) => {
  try {
    await loadRoles(req);
    next();
  } catch (error) {
    next(error);
  }
};

// 2. Middleware para verificar roles específicos
export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.session) {
        const response = new BaseResponse(401, "Unauthorized: No session found", {});
        return res.status(response.statusCode).json({ ...response });
      }
      const roles = await loadRoles(req);
      if (!roles.some((role) => allowedRoles.includes(role))) {
        const response = new BaseResponse(403, "Forbidden: Insufficient permissions", {});
        return res.status(response.statusCode).json({ ...response });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requirePermission = (permission: Permission) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.session) {
        const response = new BaseResponse(401, "Unauthorized: No session found", {});
        return res.status(response.statusCode).json({ ...response });
      }
      const roles = await loadRoles(req);
      if (!permissionsForRoles(roles).includes(permission)) {
        const response = new BaseResponse(403, "Forbidden: Insufficient permissions", {});
        return res.status(response.statusCode).json({ ...response });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requirePermissionForBodyFields = (
  fields: string[],
  permission: Permission,
  shouldRequire: (value: unknown) => boolean = (value) =>
    value !== undefined && value !== null && value !== "",
) => {
  return async (req: any, res: any, next: any) => {
    try {
      const hasProtectedValue = fields.some(
        (field) => shouldRequire(req.body?.[field]),
      );
      if (!hasProtectedValue) return next();
      if (!req.session) {
        const response = new BaseResponse(401, "Unauthorized: No session found", {});
        return res.status(response.statusCode).json({ ...response });
      }
      const roles = await loadRoles(req);
      if (!permissionsForRoles(roles).includes(permission)) {
        const response = new BaseResponse(403, "Forbidden: Insufficient permissions", {});
        return res.status(response.statusCode).json({ ...response });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

/** Protects staff access while allowing ordinary users to reach owner-checked endpoints. */
export const requirePermissionForStaff = (permission: Permission) => {
  return async (req: any, res: any, next: any) => {
    try {
      const roles = await loadRoles(req);
      const isStaff = roles.some((role) => STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]));
      if (isStaff && !permissionsForRoles(roles).includes(permission)) {
        const response = new BaseResponse(403, "Forbidden: Insufficient permissions", {});
        return res.status(response.statusCode).json({ ...response });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const getActor = (req: any): Actor => {
  const roles: string[] = req.userRoles ?? [];
  return {
    userId: req.session?.getUserId?.(),
    roles,
    permissions: permissionsForRoles(roles),
    isStaff: roles.some((r) => STAFF_ROLES.includes(r as (typeof STAFF_ROLES)[number])),
  };
};
