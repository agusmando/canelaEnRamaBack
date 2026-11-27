import express from "express";
import { OrderController } from "../controllers/order.controller.js";
import {
  attachRoles,
  isAuthenticated,
  requirePermission,
  requirePermissionForStaff,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const orderController = new OrderController();
const user = [isAuthenticated, attachRoles];

router
  .route("/")
  .get(...requirePermission("orders.manage"), orderController.findAll.bind(orderController))
  .post(...user, orderController.create.bind(orderController));
router.post("/guest", orderController.createGuest.bind(orderController));
router.post(
  "/counter",
  ...requirePermission("orders.manage"),
  orderController.createCounterSale.bind(orderController),
);
router.get("/mine", ...user, orderController.findMine.bind(orderController));
router
  .route("/:id")
  .get(...user, requirePermissionForStaff("orders.manage"), orderController.findOne.bind(orderController))
  .put(...user, requirePermissionForStaff("orders.manage"), orderController.update.bind(orderController));

export default router;
