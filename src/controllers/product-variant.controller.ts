import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

export class ProductVariantController extends GenericControllerImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  constructor() {
    super("productVariant");
  }
}
