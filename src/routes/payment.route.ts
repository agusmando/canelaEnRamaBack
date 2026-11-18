import express from "express";
import { PaymentController } from "../controllers/payment.controller.js";
import { attachRoles, isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const controller = new PaymentController();
const user = [isAuthenticated, attachRoles];

router.get("/config", controller.config.bind(controller));
router.post("/webhook", controller.webhook.bind(controller));
router.post("/order/:id/preference", ...user, controller.createPreference.bind(controller));
router.post("/order/:id/sync", ...user, controller.sync.bind(controller));
// Reintegros (solo administradores)
router
  .route("/order/:id/refund")
  .get(...requirePermission("payments.refund"), controller.refundInfo.bind(controller))
  .post(...requirePermission("payments.refund"), controller.refund.bind(controller));

export default router;
