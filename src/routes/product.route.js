const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  createProduct,
  deleteProduct,
  getOneProduct,
} = require("../controllers/product.controller.js");

router.route("/").get(getAllProducts).post(createProduct);
router.route("/:id").get(getOneProduct).delete(deleteProduct);

module.exports = router;
