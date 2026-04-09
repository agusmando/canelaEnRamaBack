import { verifySession } from "supertokens-node/recipe/session/framework/express";
import UserRoles from "supertokens-node/recipe/userroles";
import { BaseResponse } from "../utils/responseFormat.js";
// import { Response } from "express";

// 1. Middleware básico para verificar que está logueado
export const isAuthenticated = verifySession();

// 2. Middleware para verificar roles específicos
export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, res: any, next: any) => {
    // Primero aseguramos que verifySession ya corrió y existe la sesión
    if (!req.session) {
      const response = new BaseResponse(
        401,
        "Unauthorized: No session found",
        {}
      );

      return res.status(response.statusCode).json({ ...response });
    }

    const userId = req.session.getUserId();
    const tenantId = req.session.getTenantId();

    // Obtenemos los roles del usuario
    const { roles } = await UserRoles.getRolesForUser(tenantId, userId);
    // Verificamos si el usuario tiene al menos uno de los roles permitidos
    const hasRole = roles.some((role) => allowedRoles.includes(role));
    console.log("hasRole", hasRole)
    console.log("roles", roles)
    console.log("allowedRoles", allowedRoles)
    if (!hasRole) {
      const response = new BaseResponse(
        403,
        "Forbidden: Insufficient permissions",
        {}
      );
      return res.status(response.statusCode).json({ ...response });
    }

    next();
  };
};

export const optionalSession = verifySession({
    sessionRequired: false
});