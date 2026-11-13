import express from "express";
import { OrderController } from "../controllers/order.controller.js";
import {
  attachRoles,
  isAuthenticated,
  requireRole,
  STAFF_ROLES,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const orderController = new OrderController();

const user = [isAuthenticated, attachRoles];

router
  .route("/")
  .get(isAuthenticated, requireRole(STAFF_ROLES), orderController.findAll.bind(orderController))
  .post(...user, orderController.create.bind(orderController));
router.get("/mine", ...user, orderController.findMine.bind(orderController));
router
  .route("/:id")
  .get(...user, orderController.findOne.bind(orderController))
  .put(...user, orderController.update.bind(orderController));

export default router;
