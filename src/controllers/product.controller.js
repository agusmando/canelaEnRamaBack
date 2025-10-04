const {
  baseResponse,
  paginatedResponse,
} = require("../utils/responseFormat.js");
const productService = require("../services/product.service.js");

const getAllProducts = async (req, res, next) => {
  try {
    const { value = "", currentPage = 1, amountPerPage = 10 } = req.query;
    console.log(req.query);
    const response = await productService.getAllProductsService(
      value,
      Number(currentPage),
      Number(amountPerPage)
    );
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const productData = req.body;
    const response = await productService.createProduct(productData);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const getOneProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const response = await productService.getOneProductService(productId);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const response = await productService.deleteProductService(productId);
    res.status(204).json({ ...response });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  createProduct,
  deleteProduct,
  getOneProduct,
};
