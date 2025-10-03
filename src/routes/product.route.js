const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  createProduct,
  deleteProduct,
} = require("../controllers/product.controller.js");

router.route("/").get(getAllProducts).post(createProduct).delete(deleteProduct);

module.exports = router;
