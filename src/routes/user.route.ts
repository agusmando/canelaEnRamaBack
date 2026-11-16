import express from "express";
import { UserController } from "../controllers/user.controller.js";
import { attachRoles, isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const userController = new UserController();
const manage = requirePermission("users.manage");

router.use(isAuthenticated, attachRoles);
router.get("/me", userController.getMe.bind(userController));

// Gestión de usuarios y roles (rutas fijas antes de "/:supertokensId")
router.get("/", ...manage, userController.list.bind(userController));
router.get("/roles", ...manage, userController.roles.bind(userController));
router.post("/invite", ...manage, userController.invite.bind(userController));
router.get("/:supertokensId/detail", ...manage, userController.detail.bind(userController));
router.put("/:supertokensId/role", ...manage, userController.setRole.bind(userController));
router.post("/:supertokensId/revoke-sessions", ...manage, userController.revokeSessions.bind(userController));

router.get("/:supertokensId", userController.getOneBySupertokensId.bind(userController));

export default router;
