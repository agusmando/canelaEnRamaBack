import express from "express";
const router = express.Router();
import {
  getAllTags,
  createTag,
  updateTag,
  getOneTag,
} from "../controllers/tag.controller.ts";

router.route("/").get(getAllTags).post(createTag);
router.route("/:id").get(getOneTag).put(updateTag)

export default router;
