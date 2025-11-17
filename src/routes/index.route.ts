import express from "express";
const router = express.Router();

import productRoutes from "./product.route.ts";
import tagRoutes from "./tag.route.ts";

router.use("/products", productRoutes);
router.use("/tags", tagRoutes);

export default router;
