import express from "express";
import { OfferController } from "../controllers/offer.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
const router = express.Router();

const offerController = new OfferController();

const staff = ["Admin", "Employee"];

router.use(isAuthenticated);
router.use(requireRole(staff));

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
