import express from "express";
import { CartController } from "../controllers/cart.controller.js";
import {
  attachRoles,
  isAuthenticated,
  optionalSession,
  requireRole,
  STAFF_ROLES,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const cartController = new CartController();

const maybeUser = [optionalSession, attachRoles];

router
  .route("/")
  .get(isAuthenticated, requireRole(STAFF_ROLES), cartController.findAll.bind(cartController))
  .post(...maybeUser, cartController.create.bind(cartController));
router.get("/me", ...maybeUser, cartController.findMine.bind(cartController));
router
  .route("/:id")
  .get(...maybeUser, cartController.findOne.bind(cartController))
  .put(...maybeUser, cartController.update.bind(cartController));

export default router;
