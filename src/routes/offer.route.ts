import express from "express";
import { OfferController } from "../controllers/offer.controller.js";
import { requirePermission, requirePermissionToWrite } from "../middleware/auth.middleware.js";
const router = express.Router();

const offerController = new OfferController();


// Ver: cualquier staff. Modificar: offers.edit.
router.use(requirePermission("dashboard.access"));
router.use(requirePermissionToWrite("offers.edit"));

router
  .route("/")
  .get(offerController.findAll.bind(offerController))
  .post(offerController.create.bind(offerController));
router
  .route("/:id")
  .get(offerController.findOne.bind(offerController))
  .put(offerController.update.bind(offerController));
router
  .route("/:id/active/")
  .delete(offerController.deactivate.bind(offerController))
  .put(offerController.activate.bind(offerController));

export default router;
