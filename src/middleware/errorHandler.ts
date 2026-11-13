import { BaseResponse } from "../utils/responseFormat.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServerError,
  ValidationError,
} from "../errors/application/index-app.error.js"; // application errors
import {
  ForbidenError,
  InvalidCredentialsError,
  UnAuthorizedError,
} from "../errors/domain/auth/index-auth.error.js";
import {
  InvalidMeasureError,
  ProductHasNoCategoryError,
  ProductHasNoVariantsError,
} from "../errors/domain/product/index-product.error.js";
import {
  DatabaseError,
  ExternalServiceError,
} from "../errors/infra/index-infra.error.js";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

const statusFor = (err: any): number => {
  switch (true) {
    // APPLICATION ERRORS
    case err instanceof BadRequestError:
    case err instanceof ValidationError:
      return 400;
    case err instanceof ConflictError:
      return 409;
    case err instanceof NotFoundError:
      return 404;
    // DOMAIN AUTH ERRORS
    case err instanceof ForbidenError:
      return 403;
    case err instanceof InvalidCredentialsError:
    case err instanceof UnAuthorizedError:
      return 401;
    // DOMAIN PRODUCT ERRORS
    case err instanceof InvalidMeasureError:
    case err instanceof ProductHasNoCategoryError:
    case err instanceof ProductHasNoVariantsError:
      return 400;
    // Regla de negocio violada dentro de una función SQL (RAISE EXCEPTION)
    case err instanceof StoreProcedureError:
      return err.businessMessage ? 409 : 500;
    // INFRASTRUCTURE ERRORS
    case err instanceof ServerError:
    case err instanceof DatabaseError:
    case err instanceof ExternalServiceError:
    default:
      return 500;
  }
};

export const errorHandler = (rawErr: any, req: any, res: any, next: any) => {
  if (res.headersSent) return next(rawErr);

  // JSON mal formado enviado por el cliente
  if (rawErr?.type === "entity.parse.failed") {
    return res.status(400).json(new BaseResponse(400, "Invalid JSON body", {}));
  }

  const err = translatePrismaError(rawErr);
  const status = statusFor(err);

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, rawErr);
  }

  // No exponemos detalles internos de errores 500 en producción
  const message =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  res.status(status).json(new BaseResponse(status, message, {}));
};
