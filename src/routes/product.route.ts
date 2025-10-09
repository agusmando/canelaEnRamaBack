import express from "express";
const router = express.Router();
import {
  getAllProducts,
  createProduct,
  deleteProduct,
  getOneProduct,
} from "../controllers/product.controller.ts";

router.route("/").get(getAllProducts).post(createProduct);
router.route("/:id").get(getOneProduct).delete(deleteProduct);

export default router;
