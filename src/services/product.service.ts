import { BaseResponse } from "../utils/responseFormat.ts";
import { CreateProductDto } from "./../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.ts";
import { productPostProcessingQueryMapping } from "../mappings/products/product-post-procesing.mapping.ts";
import {
  ProductHasNoVariantsError,
  InvalidMeasureError,
  ProductHasNoCategoryError,
} from "../errors/domain/product/index-product.error.ts";
import {
  ValidationError,
  NotFoundError,
} from "../errors/application/index-app.error.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { ProductRepository } from "../repository/product.repository.ts";
import { ImageRepository } from "./../repository/image.repository.ts";
import { productVariantPostProcessingMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";
import { ProductVariantRepository } from "../repository/product-variant.repository.ts";

export class ProductService extends GenericServiceImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  productRepository: ProductRepository;
  productVariantRepository: ProductVariantRepository;
  imageRepository: ImageRepository;

  constructor() {
    super("product");
    this.productRepository = new ProductRepository();
    this.productVariantRepository = new ProductVariantRepository();
    this.imageRepository = new ImageRepository();
  }

  async createProduct(
    createData: CreateProductDto,
    uploadedFilesByField: Record<string, any[]>
  ): Promise<ProductDto> {
    if (createData.variants.length == 0 || !createData.variants) {
      uploadedFilesByField &&
        (await this.imageRepository.abortImageUpload(uploadedFilesByField));
      throw new ProductHasNoVariantsError();
    }
    if (createData.measureTypeId == 0 || !createData.measureTypeId) {
      uploadedFilesByField &&
        (await this.imageRepository.abortImageUpload(uploadedFilesByField));
      throw new InvalidMeasureError();
    }
    if (createData.categoryId == 0 || !createData.categoryId) {
      uploadedFilesByField &&
        (await this.imageRepository.abortImageUpload(uploadedFilesByField));
      throw new ProductHasNoCategoryError();
    }
    if (!createData.name || createData.description == "") {
      uploadedFilesByField &&
        (await this.imageRepository.abortImageUpload(uploadedFilesByField));
      throw new ValidationError();
    }

    // Creating the product
    const product = await this.productRepository.create(
      createData,
      uploadedFilesByField
    );

    // Post-creation processing
    const postMapping = productVariantPostProcessingMapping;
    const postVariants = product.variants.map((variant: any) => {
      if (!variant.profitMargin || !variant.price) return variant;
      return postMapping(variant);
    });
    product.variants = postVariants;

    // Recalculate mix price
    if (
      createData?.variants &&
      createData.variants[0] &&
      createData.variants[0].hasComponents &&
      createData.variants[0].hasComponents.length > 0
    ) {
      await this.productRepository.recalculateMixPrice(product.variants[0].id);
    }

    return product;
  }

  async update(id: number, data: UpdateProductDto): Promise<ProductDto> {
    const postMapping = productPostProcessingQueryMapping;

    if (!id || id == 0) {
      throw new NotFoundError();
    }
    // Updating the product
    let updatedProduct = await this.productRepository.update(id, data);
    console.log("a ver la data updateada", updatedProduct);

    //Post-updating processing
    if (postMapping && updatedProduct) {
      updatedProduct = postMapping(updatedProduct as any);
    }

    // Recalculate all mixes prices from one product
    if (data.price || data.profitMargin) {
      this.productRepository.recalculateAllMixesFromProduct(Number(id));
    }

    // Add, activate or deactivate variants from one product
    if (
      (data.addVariants && data.addVariants.length > 0) ||
      (data.activateVariants && data.activateVariants.length > 0) ||
      (data.deactivateVariants && data.deactivateVariants.length > 0)
    ) {
      await this.productVariantRepository.handleVariantsUpdate(
        Number(id),
        data.activateVariants,
        data.deactivateVariants,
        data.addVariants
      );
    }
    return updatedProduct;
  }

  async addRemoveProductTags(
    productId: number,
    tagData: UpdateProductTagDto,
    addingTag: boolean
  ): Promise<ProductDto> {

    if (!productId || productId == 0) {
      throw new NotFoundError();
    }
    if (!tagData.tagsId || tagData.tagsId.length == 0) {
      throw new ValidationError();
    }
    return await this.productRepository.addRemoveTags(Number(productId), tagData, addingTag);
  };
}
