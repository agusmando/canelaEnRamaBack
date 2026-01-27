import express from "express";
import { OrderItemController } from "../controllers/order-item.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
const router = express.Router();

const orderItemController = new OrderItemController();

const staff = ["Admin", "Employee"];

router
  .route("/")
  .get(
    isAuthenticated,
    requireRole(staff),
    orderItemController.findAll.bind(orderItemController),
  ) 
  .post(orderItemController.create.bind(orderItemController));
router
  .route("/:id")
  .get(
    isAuthenticated,
    requireRole(staff),
    orderItemController.findOne.bind(orderItemController),
  )
  .put(orderItemController.update.bind(orderItemController));
// router
//   .route("/:id/products")
//   .put(
//     isAuthenticated,
//     requireRole(["Admin"]),
//     orderItemController.addBrandProducts.bind(orderItemController)
//   )

export default router;
