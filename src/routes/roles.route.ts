import express from "express";
import { UserController } from "../controllers/user.controller.js";
import { requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const controller = new UserController();

router.get("/", ...requirePermission("users.manage"), controller.roles.bind(controller));

export default router;
