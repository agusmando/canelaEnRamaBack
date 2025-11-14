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
    pagina: number,
    cantidadPorPagina: number,
    totalElementos: number
  ) {
    super(statusCode, message, {
      content,
      pagination: {
        pagina: pagina || 1,
        cantidadPorPagina: cantidadPorPagina || 10,
        totalElementos: totalElementos || content.length,
      },
    });
  }
}
