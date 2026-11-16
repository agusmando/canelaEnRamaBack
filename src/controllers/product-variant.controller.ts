import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.js";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.js";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.js";
import { ProductVariantService } from "../services/product-variant.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl, parseId } from "./generic-impl.controller.js";

export class ProductVariantController extends GenericControllerImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  readonly productVariantService: ProductVariantService;

  constructor(productVariantService = new ProductVariantService()) {
    super(productVariantService);
    this.productVariantService = productVariantService;
  }

  async create(req: any, res: any, next: any) {
    try {
      const response = await this.productVariantService.createVariant(req.body, req.files);
      res.status(201).json(new BaseResponse(201, "Product variant created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.productVariantService.updateVariant(
        parseId(req.params.id),
        req.body,
        req.files,
      );
      res.status(200).json(new BaseResponse(200, "Product variant updated", response));
    } catch (error) {
      next(error);
    }
  }
}
