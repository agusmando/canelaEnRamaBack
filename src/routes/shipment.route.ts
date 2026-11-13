import express from "express";
import { ShipmentController } from "../controllers/shipment.controller.js";
import {
  attachRoles,
  isAuthenticated,
  requireRole,
  STAFF_ROLES,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const shipmentController = new ShipmentController();

const staff = [isAuthenticated, requireRole(STAFF_ROLES)];
const user = [isAuthenticated, attachRoles];

// Rutas fijas antes de "/:id"
router.get("/meta", shipmentController.meta.bind(shipmentController));
router.get("/track/:code", shipmentController.track.bind(shipmentController));
router.get("/order/:orderId", ...user, shipmentController.findByOrder.bind(shipmentController));

router
  .route("/")
  .get(...staff, shipmentController.findAll.bind(shipmentController))
  .post(...staff, shipmentController.create.bind(shipmentController));
router
  .route("/:id")
  .get(...staff, shipmentController.findOne.bind(shipmentController))
  .put(...staff, shipmentController.update.bind(shipmentController));
router.post("/:id/events", ...staff, shipmentController.addEvent.bind(shipmentController));

export default router;
