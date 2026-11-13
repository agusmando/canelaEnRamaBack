import express from "express";
import { ReviewController } from "../controllers/review.controller.js";
import {
  attachRoles,
  isAuthenticated,
  optionalSession,
  requireRole,
  STAFF_ROLES,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const reviewController = new ReviewController();

const staff = [isAuthenticated, requireRole(STAFF_ROLES)];
const user = [isAuthenticated, attachRoles];
// Público, pero el staff logueado ve todos los estados
const publicView = [optionalSession, attachRoles];

router.get("/summary", reviewController.summary.bind(reviewController));
router.get("/stats", ...staff, reviewController.stats.bind(reviewController));
router.get("/mine", ...user, reviewController.mine.bind(reviewController));
router.get("/eligible", ...user, reviewController.eligible.bind(reviewController));

router
  .route("/")
  .get(...publicView, reviewController.findAll.bind(reviewController))
  .post(...user, reviewController.create.bind(reviewController));
router
  .route("/:id")
  .put(...user, reviewController.update.bind(reviewController))
  .delete(...user, reviewController.remove.bind(reviewController));
router.put("/:id/moderate", ...staff, reviewController.moderate.bind(reviewController));

export default router;
