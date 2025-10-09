import express from "express";
const router = express.Router();

import productRoutes from "./product.route.ts";

router.use("/products", productRoutes);

export default router;
