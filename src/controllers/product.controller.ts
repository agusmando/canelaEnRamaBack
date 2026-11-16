import { CreateProductDto } from "../dto/products/create-product.dto.js";
import { ProductDto } from "../dto/products/product.dto.js";
import { UpdateProductDto } from "../dto/products/update-product.dto.js";
import { ProductService } from "../services/product.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl, parseId } from "./generic-impl.controller.js";

export class ProductController extends GenericControllerImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  readonly productService: ProductService;

  constructor(productService = new ProductService()) {
    super(productService);
    this.productService = productService;
  }

  async create(req: any, res: any, next: any) {
    try {
      const response = await this.productService.createProduct(req.body, req.files);
      res.status(201).json(new BaseResponse(201, "Product created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.productService.updateProduct(parseId(req.params.id), req.body);
      res.status(200).json(new BaseResponse(200, "Product updated", response));
    } catch (error) {
      next(error);
    }
  }

  async addProductTags(req: any, res: any, next: any) {
    try {
      const response = await this.productService.addRemoveProductTags(
        parseId(req.params.id),
        req.body,
        true,
      );
      res.status(200).json(new BaseResponse(200, "Product tags added", response));
    } catch (error) {
      next(error);
    }
  }

  async removeProductTags(req: any, res: any, next: any) {
    try {
      const response = await this.productService.addRemoveProductTags(
        parseId(req.params.id),
        req.body,
        false,
      );
      res.status(200).json(new BaseResponse(200, "Product tags removed", response));
    } catch (error) {
      next(error);
    }
  }
}
