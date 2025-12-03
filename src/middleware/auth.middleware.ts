import { verifySession } from "supertokens-node/recipe/session/framework/express";
import UserRoles from "supertokens-node/recipe/userroles";
import { BaseResponse } from "../utils/responseFormat.ts";
// import { Response } from "express";

// 1. Middleware básico para verificar que está logueado (ya lo conoces)
export const isAuthenticated = verifySession();

// 2. Middleware para verificar roles específicos
export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, res: any, next: any) => {
    // Primero aseguramos que verifySession ya corrió y existe la sesión
    if (!req.session) {
      return new BaseResponse(401, "Unauthorized: No session found", {});
    }

    const userId = req.session.getUserId();
    const tenantId = req.session.getTenantId();

    // Obtenemos los roles del usuario
    const { roles } = await UserRoles.getRolesForUser(tenantId, userId);

    console.log(roles);
    // Verificamos si el usuario tiene al menos uno de los roles permitidos
    const hasRole = roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      return new BaseResponse(403, "Forbidden: Insufficient permissions", {});
    }

    next();
  };
};
