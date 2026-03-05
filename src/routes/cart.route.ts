import express from "express";
import { CartController } from "../controllers/cart.controller.js";
import { isAuthenticated, requireRole, optionalSession } from "../middleware/auth.middleware.js";
const router = express.Router();

const cartController = new CartController();

const staff = ["Admin", "Employee"];

router
  .route("/")
  .get(
    isAuthenticated,
    requireRole(staff),
    cartController.findAll.bind(cartController),
  ) // borrar
  .post(optionalSession, cartController.create.bind(cartController));
router
  .route("/:id")
  .get(
    isAuthenticated,
    requireRole(staff),
    cartController.findOne.bind(cartController),
  )
  .put(cartController.update.bind(cartController));
// router
//   .route("/:id/products")
//   .put(
//     isAuthenticated,
//     requireRole(["Admin"]),
//     cartController.addBrandProducts.bind(cartController)
//   )

export default router;
