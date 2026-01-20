import express from "express";
import { CartItemController } from "../controllers/cart-item.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
const router = express.Router();

const cartItemController = new CartItemController();

const staff = ["Admin", "Employee"];

router
  .route("/")
  .get(
    isAuthenticated,
    requireRole(staff),
    cartItemController.findAll.bind(cartItemController),
  ) // borrar
  .post(cartItemController.create.bind(cartItemController));
router
  .route("/:id")
  .get(
    isAuthenticated,
    requireRole(staff),
    cartItemController.findOne.bind(cartItemController),
  )
  .put(cartItemController.update.bind(cartItemController));
// router
//   .route("/:id/products")
//   .put(
//     isAuthenticated,
//     requireRole(["Admin"]),
//     cartItemController.addBrandProducts.bind(cartItemController)
//   )

export default router;
