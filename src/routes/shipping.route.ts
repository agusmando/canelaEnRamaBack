import express from "express";
import { ShippingController } from "../controllers/shipping.controller.js";
import { attachRoles, isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const controller = new ShippingController();

const user = [isAuthenticated, attachRoles];
const staff = requirePermission("orders.manage");
const shippingAdmin = requirePermission("shipping.config");

router.get("/config", controller.config);

// Domicilio del cliente logueado y cotización al checkout
router.route("/address").get(...user, controller.getAddress).put(...user, controller.saveAddress);
router.get("/quote", ...user, controller.quote);

// Tarifas por departamento (staff)
router.route("/zones").get(...staff, controller.listZones).post(...shippingAdmin, controller.createZone);
router.put("/zones/:id", ...shippingAdmin, controller.updateZone);

// Repartidor (Uber Direct) para un envío
router.post("/shipment/:id/dispatch", ...staff, controller.dispatch);
router.post("/shipment/:id/sync", ...staff, controller.sync);
router.post("/shipment/:id/cancel", ...staff, controller.cancel);

export default router;
