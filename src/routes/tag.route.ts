import express from "express";
import { TagController } from "../controllers/tag.controller.js";
import { attachRoles, optionalSession, requirePermission } from "../middleware/auth.middleware.js";
import { hideCostForPublic, hideProductsForPublic } from "../middleware/publicView.js";

// Sin sesión de staff no se exponen proveedores ni costos de los productos incluidos.
const publicView = [optionalSession, attachRoles, hideCostForPublic, hideProductsForPublic];
const router = express.Router();

const tagsController = new TagController();

const manageMasters = requirePermission("masters.edit");

router
  .route("/")
  .get(...publicView, tagsController.findAll.bind(tagsController))
  .post(
    ...manageMasters,
    tagsController.create.bind(tagsController),
  );
router
  .route("/:id")
  .get(...publicView, tagsController.findOne.bind(tagsController))
  .put(
    ...manageMasters,
    tagsController.update.bind(tagsController),
  );
router
  .route("/:id/active/")
  .delete(
    ...manageMasters,
    tagsController.deactivate.bind(tagsController),
  )
  .put(
    ...manageMasters,
    tagsController.activate.bind(tagsController)
  );

export default router;
