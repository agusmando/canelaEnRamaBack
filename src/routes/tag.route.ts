import express from "express";
import { TagController } from "../controllers/tag.controller.ts";
const router = express.Router();

const tagsController = new TagController()

router.route("/").get(tagsController.findAll.bind(tagsController)).post(tagsController.create.bind(tagsController));
router.route("/:id").get(tagsController.findOne.bind(tagsController)).put(tagsController.update.bind(tagsController));
router.route("/:id/active/").delete(tagsController.deactivate.bind(tagsController)).put(tagsController.activate.bind(tagsController));

export default router;
