import express from "express";
import { OrderItemController } from "../controllers/order-item.controller.js";
import { isAuthenticated, requireRole, STAFF_ROLES } from "../middleware/auth.middleware.js";

const router = express.Router();
const orderItemController = new OrderItemController();

// Solo lectura para staff. Los ítems se modifican con PUT /order/:id (editItem).
router.use(isAuthenticated, requireRole(STAFF_ROLES));
router.get("/", orderItemController.findAll.bind(orderItemController));
router.get("/:id", orderItemController.findOne.bind(orderItemController));

export default router;
