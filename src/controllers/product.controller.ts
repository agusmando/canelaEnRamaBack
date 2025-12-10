import { CreateProductDto } from "../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { ProductService } from "../services/product.service.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

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
      const response = await productService.create(data);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const objectId = req.params.id;
      const response = await productService.update(Number(objectId), req.body);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }

  async addProductTags(req: any, res: any, next: any) {
    try {
      const productId: number = req.params.id;
      const response = await productService.addProductTags(productId, req.body);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }

  async removeProductTags(req: any, res: any, next: any) {
    try {
      const productId: number = req.params.id;
      const response = await productService.removeProductTags(
        productId,
        req.body
      );
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }
}
