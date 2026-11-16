import { verifySession } from "supertokens-node/recipe/session/framework/express";
import UserRoles from "supertokens-node/recipe/userroles";
import { BaseResponse } from "../utils/responseFormat.js";
import { permissionsFor, STAFF_ROLES, type Permission } from "../config/rbac.js";

export { STAFF_ROLES };

/** Quién hace el request, para reglas de ownership en los servicios. */
export type Actor = { userId?: string; roles: string[]; permissions: Permission[]; isStaff: boolean };

// 1. Middleware básico para verificar que está logueado
export const isAuthenticated = verifySession();

// Sesión opcional: invitados pasan sin sesión (carrito de invitado)
export const optionalSession = verifySession({ sessionRequired: false });

// Los roles se leen de SuperTokens en cada request: un cambio de rol aplica al instante.
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

// 2. Middleware para verificar roles específicos
export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, res: any, next: any) => {
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
};

/** Verifica un permiso sobre una sesión ya validada. */
const checkPermission = (permission: Permission, onlyWrites = false) => async (req: any, res: any, next: any) => {
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

/** Exige un permiso del RBAC (ver config/rbac.ts). Incluye la verificación de sesión. */
export const requirePermission = (permission: Permission) => [verifySession(), checkPermission(permission)];

/** Para `router.use` después de requirePermission: exige `permission` solo en escrituras (no GET). */
export const requirePermissionToWrite = (permission: Permission) => checkPermission(permission, true);

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
