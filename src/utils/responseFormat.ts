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
  data: T[] = [];
  pagina: number = 1;
  cantidadPorPagina: number = 10;
  totalElementos: number = 0;

  constructor(
    statusCode: number,
    message: string,
    data: T[],
    pagina: number,
    cantidadPorPagina: number,
    totalElementos: number
  ) {
    super(statusCode, message, {
      data,
      paginado: {
        pagina,
        cantidadPorPagina,
        totalElementos,
      },
    });
  }
}
