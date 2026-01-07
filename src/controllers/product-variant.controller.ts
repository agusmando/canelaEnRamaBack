import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { ProductVariantService } from "../services/product-variant.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

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
