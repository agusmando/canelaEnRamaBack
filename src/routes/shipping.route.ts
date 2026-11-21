import express from "express";
import { ShippingController } from "../controllers/shipping.controller.js";
import { isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const controller = new ShippingController();

router.get("/config", controller.config.bind(controller));
router.get("/quote", isAuthenticated, controller.quote.bind(controller));
router
  .route("/address")
  .get(isAuthenticated, controller.getAddress.bind(controller))
  .put(isAuthenticated, controller.saveAddress.bind(controller));
router
  .route("/zones")
  .get(isAuthenticated, requirePermission("shipping.config"), controller.listZones.bind(controller))
  .post(isAuthenticated, requirePermission("shipping.config"), controller.createZone.bind(controller));
router.put("/zones/:id", isAuthenticated, requirePermission("shipping.config"), controller.updateZone.bind(controller));

export default router;
