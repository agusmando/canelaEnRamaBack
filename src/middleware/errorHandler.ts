import { BaseResponse } from "../utils/responseFormat.ts";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServerError,
  ValidationError
} from "../errors/application/index-app.error.ts"; // application errors
import {
  ForbidenError,
  InvalidCredentialsError,
  UnAuthorizedError,
} from "../errors/domain/auth/index-auth.error.ts";
import {
  InvalidMeasureError,
  ProductHasNoCategoryError,
  ProductHasNoVariantsError
} from "../errors/domain/product/index-product.error.ts";
import {
  DatabaseError,
  ExternalServiceError
} from "../errors/infra/index-infra.error.ts";


export const errorHandler = (err: any, req: any, res: any, next: any) => {
  switch (true) {
    // APPLICATION ERRORS
    case err instanceof BadRequestError:
      res.status(400).json(new BaseResponse(400, err.message, {}));
      break;
    case err instanceof ConflictError:
      res.status(409).json(new BaseResponse(409, err.message, {}));
      break;
    case err instanceof NotFoundError:
      res.status(404).json(new BaseResponse(404, err.message, {}));
      break;
    case err instanceof ServerError:
      res.status(500).json(new BaseResponse(500, err.message, {}));
      break;
    case err instanceof ValidationError:
      res.status(400).json(new BaseResponse(400, err.message, {}));
      break;
    // DOMAIN AUTH ERRORS
    case err instanceof ForbidenError:
      res.status(403).json(new BaseResponse(403, err.message, {}));
      break;
    case err instanceof InvalidCredentialsError:
      res.status(401).json(new BaseResponse(401, err.message, {}));
      break;
    case err instanceof UnAuthorizedError:
      res.status(401).json(new BaseResponse(401, err.message, {}));
      break;
    // DOMAIN PRODUCT ERRORS
    case err instanceof InvalidMeasureError:
      res.status(400).json(new BaseResponse(400, err.message, {}));
      break;
    case err instanceof ProductHasNoCategoryError:
      res.status(400).json(new BaseResponse(400, err.message, {}));
      break;
    case err instanceof ProductHasNoVariantsError:
      res.status(400).json(new BaseResponse(400, err.message, {}));
      break;
    // INFRASTRUCTURE ERRORS
    case err instanceof DatabaseError:
      res.status(500).json(new BaseResponse(500, err.message, {}));
      break;
    case err instanceof ExternalServiceError:
      res.status(500).json(new BaseResponse(500, err.message, {}));
      break;
    default:
      res.status(500).json(new BaseResponse(500, err.message, {}));
  }
};
