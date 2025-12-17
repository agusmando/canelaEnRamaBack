import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { ProductVariantService } from "../services/product-variant.service.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

const productVariantService = new ProductVariantService();
export class ProductVariantController extends GenericControllerImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {

  constructor() {
    super("productVariant");
  }

   async update(req: any, res: any, next: any) {
    try {
      const objectId = req.params.id;
      const response = await productVariantService.update(Number(objectId), req.body);
      res.status(response.statusCode).json({ ...response });
    } catch (error) {
      next(error);
    }
  }
}
