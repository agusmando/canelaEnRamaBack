import express from "express";
const router = express.Router();

import productRoutes from "./product.route.js";
import productVariantRoutes from "./product-variant.route.js";
import tagRoutes from "./tag.route.js";
import categoryRoutes from "./category.route.js";
import supplierRoutes from "./supplier.route.js";
import movementRoutes from "./movement.route.js";
import brandRoutes from "./brand.route.js";
import offerRoutes from "./offer.route.js";
import cartRoutes from "./cart.route.js";
import cartItemRoutes from "./cart-item.route.js";
import orderRoutes from "./order.route.js";
import orderItemRoutes from "./order-item.route.js";
import userRoutes from "./user.route.js";

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Las rutas más específicas van ANTES: si no, "/order/item" matchea "/order/:id"
router.use("/product/variant", productVariantRoutes);
router.use("/product", productRoutes);
router.use("/tag", tagRoutes);
router.use("/category", categoryRoutes);
router.use("/supplier", supplierRoutes);
router.use("/brand", brandRoutes);
router.use("/movement", movementRoutes);
router.use("/offer", offerRoutes);
router.use("/cart/item", cartItemRoutes);
router.use("/cart", cartRoutes);
router.use("/order/item", orderItemRoutes);
router.use("/order", orderRoutes);
router.use("/user", userRoutes);

export default router;
