import express from "express";
const router = express.Router();

import productRoutes from "./product.route.ts";
import productVariantRoutes from "./product-variant.route.ts";
import tagRoutes from "./tag.route.ts";
import categoryRoutes from "./category.route.ts";
import supplierRoutes from "./supplier.route.ts";
import movementRoutes from "./movement.route.ts";
import brandRoutes from "./brand.route.ts";
import offerRoutes from "./offer.route.ts";
import cartRoutes from "./cart.route.ts";
import cartItemRoutes from "./cart-item.route.ts";
import orderRoutes from "./order.route.ts";
import orderItemRoutes from "./order-item.route.ts";

router.use("/product", productRoutes);
router.use("/product/variant", productVariantRoutes);
router.use("/tag", tagRoutes);
router.use("/category", categoryRoutes);
router.use("/supplier", supplierRoutes);
router.use("/brand", brandRoutes);
router.use("/movement", movementRoutes);
router.use("/offer", offerRoutes);
router.use("/cart", cartRoutes);
router.use("/cart/item", cartItemRoutes);
router.use("/order", orderRoutes)
router.use("/order/item", orderItemRoutes)

export default router;
