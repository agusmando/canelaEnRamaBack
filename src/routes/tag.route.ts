import express from "express";
import { TagController } from "../controllers/tag.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
const router = express.Router();

const tagsController = new TagController();

const staff = ["Admin", "Employee"];

router
  .route("/")
  .get(tagsController.findAll.bind(tagsController))
  .post(
    isAuthenticated,
    requireRole(staff),
    tagsController.create.bind(tagsController)
  );
router
  .route("/:id")
  .get(tagsController.findOne.bind(tagsController))
  .put(
    isAuthenticated,
    requireRole(staff),
    tagsController.update.bind(tagsController)
  );
router
  .route("/:id/active/")
  .delete(
    isAuthenticated,
    requireRole(staff),
    tagsController.deactivate.bind(tagsController)
  )
  .put(
    isAuthenticated,
    requireRole(staff),
    tagsController.activate.bind(tagsController)
  );

export default router;
