const {
  baseResponse,
  paginatedResponse,
} = require("../utils/responseFormat.js");
const productService = require("../services/product.service.js");

const getAllProducts = async (req, res, next) => {
  try {
    const { value = "", pagina = 1, cantidadPorPagina = 10 } = req.query;
    console.log(req.query);
    const response = await productService.getAllProducts(
      value,
      Number(pagina),
      Number(cantidadPorPagina)
    );
    console.log("Llega a esta parte", response);
    res.status(response.statusCode).json(response);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
};
