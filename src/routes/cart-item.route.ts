import express from "express";
import { CartItemController } from "../controllers/cart-item.controller.js";
import { isAuthenticated, requireRole, STAFF_ROLES } from "../middleware/auth.middleware.js";

const router = express.Router();
const cartItemController = new CartItemController();

// Solo lectura para staff. Los ítems se gestionan con PUT /cart/:token.
router.get(
  "/",
  isAuthenticated,
  requireRole(STAFF_ROLES),
  cartItemController.findAll.bind(cartItemController),
);

export default router;
