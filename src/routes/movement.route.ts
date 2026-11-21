import express from "express";
import { MovementController } from "../controllers/movement.controller.js";
import { isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";
const router = express.Router();

const movementController = new MovementController();

router.use(isAuthenticated);
router.use(requirePermission("stock.manage"));

router.post("/bulk", movementController.createBulk.bind(movementController));
router
  .route("/")
  .get(movementController.findAll.bind(movementController))
  .post(movementController.create.bind(movementController));
router.route("/:id").get(movementController.findOne.bind(movementController));

export default router;
