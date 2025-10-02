class AppError extends Error {
  constructor(errorEnum) {
    super(errorEnum.message);
    this.statusCode = errorEnum.statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
