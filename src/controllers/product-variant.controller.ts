import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.js";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.js";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.js";
import { ProductVariantService } from "../services/product-variant.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

export class ProductVariantController extends GenericControllerImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  productVariantService: ProductVariantService;

  constructor() {
    super("productVariant");
    this.productVariantService = new ProductVariantService();
  }

  async create(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const files = req.files;
      const response = await this.productVariantService.createVariant(
        data,
        files
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Product variant created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const objectId = Number(req.params.id);
      const files = req.files;
      const response = await this.productVariantService.updateVariant(
        objectId,
        data,
        files
      );
      res
        .status(200)
        .json(new BaseResponse(200, "Product variant updated", response));
    } catch (error) {
      next(error);
    }
  }
}
