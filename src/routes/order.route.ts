import express from "express";
import { OrderController } from "../controllers/order.controller.js";
import { isAuthenticated, requireRole, optionalSession } from "../middleware/auth.middleware.js";
const router = express.Router();

const orderController = new OrderController();

const staff = ["ADMIN", "EMPLOYEE"];

router
  .route("/")
  .get(
    isAuthenticated,
    requireRole(staff),
    orderController.findAll.bind(orderController),
  ) // borrar
  .post(optionalSession, orderController.create.bind(orderController));
router
  .route("/:id")
  .get(
    isAuthenticated,
    requireRole(staff),
    orderController.findOne.bind(orderController),
  )
  .put(orderController.update.bind(orderController));
// router
//   .route("/:id/products")
//   .put(
//     isAuthenticated,
//     requireRole(["ADMIN"]),
//     orderController.addBrandProducts.bind(orderController)
//   )

export default router;
