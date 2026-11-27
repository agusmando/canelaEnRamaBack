import express from "express";
import { SettingsController } from "../controllers/settings.controller.js";
import { attachRoles, isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const settingsController = new SettingsController();

// Horarios del local: lectura pública (la web y los mails los usan),
// escritura solo para quien edita contenido del sitio.
router.get("/hours", settingsController.getHours.bind(settingsController));
router.put(
  "/hours",
  isAuthenticated,
  attachRoles,
  requirePermission("content.edit"),
  settingsController.saveHours.bind(settingsController),
);

export default router;
