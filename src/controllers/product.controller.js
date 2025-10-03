const {
  baseResponse,
  paginatedResponse,
} = require("../utils/responseFormat.js");
const { getAllProductsService } = require("../services/product.service.js");

const getAllProducts = async (req, res, next) => {
  try {
    const { value = "", currentPage = 1, amountPerPage = 10 } = req.query;
    const response = await getAllProductsService(
      value,
      Number(currentPage),
      Number(amountPerPage)
    );
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
};
