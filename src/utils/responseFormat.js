class BaseResponse {
  constructor(message = "", statusCode = 200, response = {}) {
    this.message = message;
    this.statusCode = statusCode;
    this.response = response;
  }
}

class PaginatedResponse extends BaseResponse {
  constructor(statusCode, message, data, pagina, cantidadPorPagina) {
    super(statusCode, message, {
      data,
      paginado: {
        pagina,
        cantidadPorPagina,
        totalPaginas: Math.ceil(totalElementos / cantidadPorPagina),
      },
    });
  }
}

module.exports = {
  BaseResponse,
  PaginatedResponse,
};
