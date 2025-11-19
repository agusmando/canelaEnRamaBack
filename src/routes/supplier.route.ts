import express from "express";
import { SupplierController } from "../controllers/supplier.controller.ts";
const router = express.Router();

const supplierController = new SupplierController()

router.route("/").get(supplierController.findAll.bind(supplierController)).post(supplierController.create.bind(supplierController));
router.route("/:id").get(supplierController.findOne.bind(supplierController)).put(supplierController.update.bind(supplierController));
router.route("/:id/active/").delete(supplierController.deactivate.bind(supplierController)).put(supplierController.activate.bind(supplierController));

export default router;
