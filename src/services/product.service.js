const { PrismaClient } = require("@prisma/client");
const {
  BaseResponse,
  Pagination,
  PaginatedResponse,
} = require("../utils/responseFormat");
const ErrorsEnum = require("../errors/ErrorsEnum");
const AppError = require("../errors/AppError");

const prisma = new PrismaClient();

const getAllProductsService = async (value, currentPage, amountPerPage) => {
  const where = {
    name: {
      contains: value,
    },
  };
  const [totalElements, products] = await Promise.all([
    prisma.product.count({
      where,
    }),
    prisma.product.findMany({
      where,
      skip: (currentPage - 1) * amountPerPage,
      take: amountPerPage,
    }),
  ]);
  if (totalElements === 0) {
    throw new AppError(ErrorsEnum.NOT_FOUND);
  }
  return new PaginatedResponse(
    200,
    "Productos obtenidos con éxito",
    products,
    currentPage,
    amountPerPage,
    totalElements
  );
};

module.exports = {
  getAllProductsService,
};
