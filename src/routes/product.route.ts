import express from "express";
import { ProductController } from "../controllers/product.controller.ts";
const router = express.Router();

const productController = new ProductController();

router.route("/").get(productController.findAll.bind(productController)).post(productController.create.bind(productController));
router.route("/:id").get(productController.findOne.bind(productController)).put(productController.update.bind(productController))
router.route('/:id/tags').put(productController.addProductTags.bind(productController)).delete(productController.removeProductTags.bind(productController));
router.route("/:id/active/").delete(productController.deactivate.bind(productController)).put(productController.activate.bind(productController));

export default router;
