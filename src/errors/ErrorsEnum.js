const ErrorsEnum = {
  INVALID_CREDENTIALS: { statusCode: 401, message: "Invalid credentials" },
  NOT_FOUND: { statusCode: 404, message: "Resource not found" },
  SERVER_ERROR: { statusCode: 500, message: "Internal server error" },
  BAD_REQUEST: { statusCode: 400, message: "Bad request" },
  UNAUTHORIZED: { statusCode: 401, message: "Unauthorized access" },
  FORBIDDEN: { statusCode: 403, message: "Forbidden" },
  CONFLICT: { statusCode: 409, message: "Conflict" },
  UNPROCESSABLE_ENTITY: { statusCode: 422, message: "Unprocessable entity" },
};

module.exports = ErrorsEnum;
