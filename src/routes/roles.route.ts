import express from "express";
import { UserController } from "../controllers/user.controller.js";
import { isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const controller = new UserController();

router.get("/", isAuthenticated, requirePermission("users.manage"), controller.findRoles.bind(controller));

export default router;
