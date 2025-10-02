const express = require("express");
const router = express.Router();
const { getAllProducts } = require("../controllers/product.controller.js");

router.route("/").get(getAllProducts);

module.exports = router;
