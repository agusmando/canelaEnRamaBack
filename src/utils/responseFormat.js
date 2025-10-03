class BaseResponse {
  constructor(message = "", statusCode = 200, response = {}) {
    this.message = message;
    this.statusCode = statusCode;
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
    super(message, statusCode, {
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
