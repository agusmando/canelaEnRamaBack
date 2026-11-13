import express from "express";
import { GoogleReviewController } from "../controllers/google-review.controller.js";
import { isAuthenticated, requireRole, STAFF_ROLES } from "../middleware/auth.middleware.js";

const router = express.Router();
const controller = new GoogleReviewController();
const staff = [isAuthenticated, requireRole(STAFF_ROLES)];

router.get("/", controller.getPublic.bind(controller));
router.get("/all", ...staff, controller.getAll.bind(controller));
router.post("/sync", ...staff, controller.sync.bind(controller));
router.put("/:id", ...staff, controller.update.bind(controller));

export default router;
