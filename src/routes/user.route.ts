import express from "express";
import { UserController } from "../controllers/user.controller.js";
import { attachRoles, isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
const userController = new UserController();
const manageUsers = requirePermission("users.manage");

// Rutas fijas antes de "/:supertokensId".
router.get("/", ...manageUsers, userController.list.bind(userController));
router.get("/roles", ...manageUsers, userController.roles.bind(userController));
router.post("/invite", ...manageUsers, userController.invite.bind(userController));
router.get("/:supertokensId/detail", ...manageUsers, userController.detail.bind(userController));
router.put("/:supertokensId/role", ...manageUsers, userController.setRole.bind(userController));
router.post("/:supertokensId/revoke-sessions", ...manageUsers, userController.revokeSessions.bind(userController));

router.get("/me", isAuthenticated, attachRoles, userController.getMe.bind(userController));
router.use(isAuthenticated, attachRoles);
router.get("/:supertokensId", userController.getOneBySupertokensId.bind(userController));

export default router;
