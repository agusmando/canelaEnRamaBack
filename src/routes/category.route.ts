import express from "express";
import { CategoryController } from "../controllers/category.controller.ts";
const router = express.Router();

const categoryController = new CategoryController()

router.route("/").get(categoryController.findAll.bind(categoryController)).post(categoryController.create.bind(categoryController));
router.route("/:id").get(categoryController.findOne.bind(categoryController)).put(categoryController.update.bind(categoryController));
router.route("/:id/active/").delete(categoryController.deactivate.bind(categoryController)).put(categoryController.activate.bind(categoryController));

export default router;
