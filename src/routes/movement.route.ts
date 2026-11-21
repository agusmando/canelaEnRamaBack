import express from "express";
import { MovementController } from "../controllers/movement.controller.js";
import { requirePermission, requirePermissionToWrite } from "../middleware/auth.middleware.js";
const router = express.Router();

const movementController = new MovementController();


// Ver: cualquier staff. Registrar: stock.manage.
router.use(requirePermission("dashboard.access"));
router.use(requirePermissionToWrite("stock.manage"));

router.post("/bulk", movementController.createBulk.bind(movementController));
router
  .route("/")
  .get(movementController.findAll.bind(movementController))
  .post(movementController.create.bind(movementController));
router.route("/:id").get(movementController.findOne.bind(movementController));

export default router;
