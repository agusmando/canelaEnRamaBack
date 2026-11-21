import express from "express";
import { TagController } from "../controllers/tag.controller.js";
import { isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";
const router = express.Router();

const tagsController = new TagController();

const manageMasters = [isAuthenticated, requirePermission("masters.edit")];

router
  .route("/")
  .get(tagsController.findAll.bind(tagsController))
  .post(
    ...manageMasters,
    tagsController.create.bind(tagsController)
  );
router
  .route("/:id")
  .get(tagsController.findOne.bind(tagsController))
  .put(
    ...manageMasters,
    tagsController.update.bind(tagsController)
  );
router
  .route("/:id/active/")
  .delete(
    ...manageMasters,
    tagsController.deactivate.bind(tagsController)
  )
  .put(
    ...manageMasters,
    tagsController.activate.bind(tagsController)
  );

export default router;
