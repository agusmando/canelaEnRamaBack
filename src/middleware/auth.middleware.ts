import { verifySession } from "supertokens-node/recipe/session/framework/express";
import UserRoles from "supertokens-node/recipe/userroles";
import { BaseResponse } from "../utils/responseFormat.js";
import { permissionsFor, STAFF_ROLES, type Permission } from "../config/rbac.js";

export { STAFF_ROLES };

/** Quién hace el request, para reglas de ownership en los servicios. */
export type Actor = { userId?: string; roles: string[]; permissions: Permission[]; isStaff: boolean };

export const isAuthenticated = verifySession();
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

const deny = (res: any, status: 401 | 403, message: string) => {
  const response = new BaseResponse(status, message, {});
  return res.status(status).json({ ...response });
};

export const requireRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  try {
    if (!req.session) return deny(res, 401, "Unauthorized: No session found");
    const roles = await loadRoles(req);
    if (!roles.some((role) => allowedRoles.includes(role))) {
      return deny(res, 403, "No tenés permisos para esta acción");
    }
    next();
  } catch (error) {
    next(error);
  }
};

const checkPermission =
  (permission: Permission, onlyWrites = false) => async (req: any, res: any, next: any) => {
    try {
      if (onlyWrites && req.method === "GET") return next();
      const roles = await loadRoles(req);
      if (!permissionsFor(roles).includes(permission)) {
        return deny(res, 403, "No tenés permisos para esta acción");
      }
      next();
    } catch (error) {
      next(error);
    }
  };

/** Exige sesión y un permiso del RBAC (ver config/rbac.ts). */
export const requirePermission = (permission: Permission) => [verifySession(), checkPermission(permission)];

/** Para `router.use` después de un permiso de lectura: exige permiso solo en escrituras. */
export const requirePermissionToWrite = (permission: Permission) => checkPermission(permission, true);

export const requirePermissionForBodyFields = (
  fields: string[],
  permission: Permission,
  shouldRequire: (value: unknown) => boolean = (value) => value !== undefined && value !== null && value !== "",
) => async (req: any, res: any, next: any) => {
  try {
    if (!fields.some((field) => shouldRequire(req.body?.[field]))) return next();
    if (!req.session) return deny(res, 401, "Unauthorized: No session found");
    const roles = await loadRoles(req);
    if (!permissionsFor(roles).includes(permission)) {
      return deny(res, 403, "No tenés permisos para esta acción");
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** Exige permiso al staff, pero deja que los servicios validen ownership de clientes. */
export const requirePermissionForStaff = (permission: Permission) => async (req: any, res: any, next: any) => {
  try {
    const roles = await loadRoles(req);
    const isStaff = roles.some((role) => STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]));
    if (isStaff && !permissionsFor(roles).includes(permission)) {
      return deny(res, 403, "No tenés permisos para esta acción");
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const getActor = (req: any): Actor => {
  const roles: string[] = req.userRoles ?? [];
  const permissions = permissionsFor(roles);
  return {
    userId: req.session?.getUserId?.(),
    roles,
    permissions,
    isStaff: permissions.includes("dashboard.access"),
  };
};
