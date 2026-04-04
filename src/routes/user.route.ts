import express from "express";
import { UserController } from "../controllers/user.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
const router = express.Router();

const userController = new UserController();

// const staff = ["Admin", "Employee"];

// router.use(isAuthenticated);
// router.use(requireRole(staff));

router
  .route("/:supertokensId")
  .get(userController.getOneBySupertokensId.bind(userController));

export default router;
