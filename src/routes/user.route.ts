import express from "express";
import { UserController } from "../controllers/user.controller.js";
import { attachRoles, isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();
const userController = new UserController();

router.use(isAuthenticated, attachRoles);
router.get("/me", userController.getMe.bind(userController));
router.get("/:supertokensId", userController.getOneBySupertokensId.bind(userController));

export default router;
