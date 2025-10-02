const express = require("express");
const router = express.Router();

const productRoutes = require("./product.route.js");

router.use("/products", productRoutes);

module.exports = router;
