import express from "express";
const router = express.Router();

import productRoutes from "./product.route.ts";
import tagRoutes from "./tag.route.ts";
import categoryRoutes from "./category.route.ts";

router.use("/product", productRoutes);
router.use("/tag", tagRoutes);
router.use("/category", categoryRoutes);

export default router;
