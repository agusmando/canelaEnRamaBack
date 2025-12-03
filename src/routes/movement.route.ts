import express from "express";
import { MovementController } from "../controllers/movement.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
const router = express.Router();

const movementController = new MovementController();

const staff = ["Admin", "Employee"];

router.use(isAuthenticated);
router.use(requireRole(staff));

router
  .route("/")
  .get(movementController.findAll.bind(movementController))
  .post(movementController.create.bind(movementController));
router.route("/:id").get(movementController.findOne.bind(movementController));

export default router;
