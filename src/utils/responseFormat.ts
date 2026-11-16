export class BaseResponse<T> {
  statusCode: number;
  message: string;
  response: T | {};

  constructor(statusCode = 200, message = "", response = {}) {
    this.statusCode = statusCode;
    this.message = message;
    this.response = response;
  }
}

export class PaginatedResponse<T> extends BaseResponse<T> {

  constructor(
    statusCode: number,
    message: string,
    content: T[],
    page: number,
    amountPerPage: number,
    totalAmount: number
  ) {
    super(statusCode, message, {
      content,
      pagination: {
        page: page || 1,
        amountPerPage: amountPerPage || 10,
        totalAmount: totalAmount || content.length,
      },
    });
  }
}
