export class AppError extends Error {
  statusCode: number;
  constructor(errorEnum: { statusCode: number; message: string }) {
    super(errorEnum.message);
    this.statusCode = errorEnum.statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}
