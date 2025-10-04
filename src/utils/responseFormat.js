class BaseResponse {
  constructor(statusCode = 200, message = "", response = {}) {
    this.statusCode = statusCode;
    this.message = message;
    this.response = response;
  }
}

class PaginatedResponse extends BaseResponse {
  constructor(
    statusCode,
    message,
    data,
    pagina,
    cantidadPorPagina,
    totalElementos
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

module.exports = {
  BaseResponse,
  PaginatedResponse,
};
