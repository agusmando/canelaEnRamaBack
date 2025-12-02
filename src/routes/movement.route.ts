import express from "express";
import { MovementController } from "../controllers/movement.controller.ts";
const router = express.Router();

const movementController = new MovementController();

router
  .route("/")
  .get(movementController.findAll.bind(movementController))
  .post(movementController.create.bind(movementController));
router.route("/:id").get(movementController.findOne.bind(movementController));

export default router;
