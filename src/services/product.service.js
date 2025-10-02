const { PrismaClient } = require("@prisma/client");
const {
  BaseResponse,
  Pagination,
  PaginatedResponse,
} = require("../utils/responseFormat");
const { ErrorsEnum } = require("../errors/ErrorsEnum");

const prisma = new PrismaClient();

const getAllProducts = async (value, paginaActual, cantidadPorPagina) => {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: value },
    },
  });

  if (products.length === 0) {
    throw new AppError(ErrorsEnum.NOT_FOUND);
  }
  console.log(
    new PaginatedResponse(
      200,
      "Productos obtenidos con éxito",
      products,
      paginaActual,
      cantidadPorPagina
    )
  );
  return new PaginatedResponse(
    200,
    "Productos obtenidos con éxito",
    productos,
    paginaActual,
    cantidadPorPagina
  );
};

module.exports = {
  getAllProducts,
};
