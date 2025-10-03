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
  try {
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
  } catch (error) {
    console.error("Error fetching products:", error);
    throw new AppError(ErrorsEnum.SERVER_ERROR);
  }
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

const createProduct = async (productData) => {
  try {
    const newProduct = await prisma.product.create({
      data: productData,
    });
    return new BaseResponse(201, "Producto creado con éxito", newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    throw new AppError(ErrorsEnum.SERVER_ERROR);
  }
};

const deleteProductService = async (productId) => {
  try {
    await prisma.product.delete({
      where: { id: productId },
    });
    return new BaseResponse(204, "Producto eliminado con éxito", null);
  } catch (error) {
    throw new AppError(ErrorsEnum.NOT_FOUND);
  }
};

module.exports = {
  getAllProductsService,
  createProduct,
  deleteProductService,
};
