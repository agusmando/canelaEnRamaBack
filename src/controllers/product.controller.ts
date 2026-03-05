import { CreateProductDto } from "../dto/products/create-product.dto.js";
import { ProductDto } from "../dto/products/product.dto.js";
import { UpdateProductDto } from "../dto/products/update-product.dto.js";
import { ProductService } from "../services/product.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

const productService = new ProductService();

export class ProductController extends GenericControllerImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  constructor() {
    super("product");
  }

  async create(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const files = req.files;
      const response = await productService.createProduct(data, files);
      res.status(201).json(new BaseResponse(200, "Product created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const objectId = Number(req.params.id);
      const response = await productService.updateProduct(objectId, data);
      res.status(200).json(new BaseResponse(200, "Product updated", response));
    } catch (error) {
      next(error);
    }
  }

  async addProductTags(req: any, res: any, next: any) {
    try {
      const productId: number = req.params.id;
      const response = await productService.addRemoveProductTags(
        Number(productId),
        req.body,
        true
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Product tags added", response));
    } catch (error) {
      next(error);
    }
  }

  async removeProductTags(req: any, res: any, next: any) {
    try {
      const productId: number = req.params.id;
      const response = await productService.addRemoveProductTags(
        Number(productId),
        req.body,
        false
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Product tags removed", response));
    } catch (error) {
      next(error);
    }
  }
}
