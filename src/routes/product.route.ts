import express from "express";
const router = express.Router();
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  activateProduct,
  getOneProduct,
  addProductTags,
  removeProductTags,
} from "../controllers/product.controller.ts";

router.route("/").get(getAllProducts).post(createProduct);
router.route("/:id").get(getOneProduct).put(updateProduct)
router.route('/:id/tags').put(addProductTags).delete(removeProductTags)
router.route("/:id/active/").delete(deactivateProduct).put(activateProduct);

export default router;
