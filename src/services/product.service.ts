import { CreateProductDto } from "./../dto/products/create-product.dto.ts";
import { ProductDto } from "../dto/products/product.dto.ts";
import { UpdateProductDto } from "../dto/products/update-product.dto.ts";
import { UpdateProductTagDto } from "../dto/products/update-product-tag.dto.ts";
import { productPostProcessingMapping } from "../mappings/products/product-post-procesing.mapping.ts";
import {
  ProductHasNoVariantsError,
  InvalidMeasureError,
  ProductHasNoCategoryError,
} from "../errors/domain/product/index-product.error.ts";
import {
  ValidationError,
  NotFoundError,
  BadRequestError,
} from "../errors/application/index-app.error.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { ProductRepository } from "../repository/product.repository.ts";
import { ProductVariantRepository } from "../repository/product-variant.repository.ts";
import { ImageService } from "./image.service.ts";

export class ProductService extends GenericServiceImpl<
  ProductDto,
  CreateProductDto,
  UpdateProductDto
> {
  productRepository: ProductRepository;
  productVariantRepository: ProductVariantRepository;
  imageService: ImageService;

  constructor() {
    super("product");
    this.productRepository = new ProductRepository();
    this.productVariantRepository = new ProductVariantRepository();
    this.imageService = new ImageService();
  }

  async createProduct(
    createData: CreateProductDto,
    uploadedFilesByField: any[],
  ): Promise<ProductDto> {
    return this.productRepository.withTransaction(async (tx) => {
      if (
        createData.variants.length == 0 ||
        !createData.variants ||
        createData.measureTypeId == 0 ||
        !createData.measureTypeId ||
        createData.categoryId == 0 ||
        !createData.categoryId ||
        !createData.name ||
        createData.description == ""
      ) {
        uploadedFilesByField &&
          (await this.imageService.abortImageUpload(uploadedFilesByField));
        if (createData.variants.length == 0 || !createData.variants) {
          throw new ProductHasNoVariantsError();
        }
        if (createData.measureTypeId == 0 || !createData.measureTypeId) {
          throw new InvalidMeasureError();
        }
        if (createData.categoryId == 0 || !createData.categoryId) {
          throw new ProductHasNoCategoryError();
        }
        if (!createData.name || createData.description == "") {
          throw new ValidationError(
            "Product name and description are required for creating a product",
          );
        }
      }

      // Creating the product
      const product = await this.productRepository.createProduct(
        createData,
        uploadedFilesByField,
        tx,
      );

      console.log("product", product);
      // Post-creation processing
      const postMapping = productPostProcessingMapping;
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
        await this.productVariantRepository.recalculateSingleMixPrice(
          product.variants[0].id,
          tx,
        );
      }

      return product;
    });
  }

  async updateProduct(id: number, data: UpdateProductDto): Promise<ProductDto> {
    const postMapping = productPostProcessingMapping;

    if (!id || id == 0) {
      throw new NotFoundError();
    }

    if (!data) {
      throw new BadRequestError();
    }

    return this.productRepository.withTransaction(async (tx) => {
      // Updating the product
      let updatedProduct = await this.productRepository.update(id, data);
      console.log("a ver la data updateada", updatedProduct);

      //Post-updating processing
      if (postMapping && updatedProduct) {
        updatedProduct = postMapping(updatedProduct as any);
      }

      // Recalculate all mixes prices from one product
      if (data.price || data.profitMargin) {
        this.productVariantRepository.recalculateAllMixesFromProduct(
          Number(id),
          tx,
        );
      }

      // Add, remove, activate or deactivate variants from one product
      if (
        (data.addVariants && data.addVariants.length > 0) ||
        (data.activateVariants && data.activateVariants.length > 0) ||
        (data.deactivateVariants && data.deactivateVariants.length > 0) ||
        (data.removeVariants && data.removeVariants.length > 0)
      ) {
        await this.productVariantRepository.handleVariantsUpdate(
          Number(id),
          data.activateVariants,
          data.deactivateVariants,
          data.addVariants,
          data.removeVariants,
          tx,
        );
      }
      return updatedProduct;
    });
  }

  async addRemoveProductTags(
    productId: number,
    tagData: UpdateProductTagDto,
    addingTag: boolean,
  ): Promise<ProductDto> {
    if (!productId || productId == 0) {
      throw new NotFoundError();
    }
    if (!tagData.tagsId || tagData.tagsId.length == 0) {
      throw new ValidationError(
        "Tag ids are required for adding tags to product",
      );
    }
    return this.productRepository.withTransaction(async (tx) => {
      return await this.productRepository.addRemoveTags(
        Number(productId),
        tagData,
        addingTag,
        tx,
      );
    });
  }
}
