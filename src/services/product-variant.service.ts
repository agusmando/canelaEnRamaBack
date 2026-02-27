import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.ts";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.ts";
import { productVariantPostProcessingMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.ts";
import { ProductVariantRepository } from "../repository/product-variant.repository.ts";
import { NotFoundError } from "../errors/application/NotFoundError.ts";
import { BadRequestError } from "../errors/application/BadRequestError.ts";
import { ImageService } from "./image.service.ts";
import { ServerError } from "../errors/application/ServerError.ts";

export class ProductVariantService extends GenericServiceImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  imageService: ImageService;
  productVariantRepository: ProductVariantRepository;
  constructor() {
    super("productVariant");
    this.productVariantRepository = new ProductVariantRepository();
    this.imageService = new ImageService();
  }

  async updateVariant(
    id: number,
    data: UpdateProductVariantDto,
    uploadedFilesByField: any[],
  ): Promise<ProductVariantDto> {
    const postMapping = productVariantPostProcessingMapping;

    if (!id || id == 0) {
      uploadedFilesByField &&
        (await this.imageService.abortImageUpload(uploadedFilesByField));
      throw new NotFoundError();
    }

    if (!data) {
      uploadedFilesByField &&
        (await this.imageService.abortImageUpload(uploadedFilesByField));
      throw new BadRequestError();
    }

    return this.productVariantRepository.withTransaction(async (tx) => {
      let updatedVariant = await this.productVariantRepository.updateVariant(
        id,
        data,
        uploadedFilesByField,
        tx
      );

      console.log("a ver la data updateada", updatedVariant);

      //Post processing mapping
      if (postMapping && updatedVariant) {
        updatedVariant = postMapping(updatedVariant as any);
      }

      // Actualiza situaciones de stock y precio relacionadas con el stock de un mix, y el precio de sus componentes.
      await this.mixRelatedStockQueries(data, id, updatedVariant as any);

      if (
        (data.addComponents && data.addComponents.length > 0) ||
        (data.removeComponents && data.removeComponents.length > 0) ||
        (data.editComponents && data.editComponents.length > 0)
      ) {
        await this.handleVariantsUpdate(
          Number(id),
          data.removeComponents,
          data.editComponents,
          data.addComponents,
          tx
        );
      }

      if (data.removeImages && data.removeImages.length > 0) {
        await this.imageService.removeImages(data.removeImages);
      }

      return updatedVariant;
    });
  }

  // añade, elimina y edita componentes de un mix. Luego recalcula el precio del mix
  async handleVariantsUpdate(
    mixVariantId: number,
    removeComponents?: { productVariantId: number }[],
    editComponents?: { productVariantId: number; quantity: number }[],
    addComponents?: { productVariantId: number; quantity: number }[],
    tx?: any
  ) {
    try {
      if (removeComponents) {
        const componentPromises = removeComponents.map(async (component: any) => {
        return await this.productVariantRepository.removeVariant(
          mixVariantId,
          component.productVariantId,
          tx
        );
      });
      await Promise.all(componentPromises);
      await this.productVariantRepository.recalculateSingleMixPrice(
        mixVariantId,
        tx
      );
    }
    if (editComponents) {
      const componentPromises = editComponents.map(
        async (component: { productVariantId: number; quantity: number }) => {
          return await this.productVariantRepository.updateMixVariant(
            mixVariantId,
            component.productVariantId,
            component.quantity,
            tx
          );
        },
      );
      await Promise.all(componentPromises);
      await this.productVariantRepository.recalculateSingleMixPrice(
        mixVariantId,
        tx
      );
    }
    if (addComponents) {
      const componentPromises = addComponents.map(async (component: any) => {
        return await this.productVariantRepository.addComponentToVariant(
          component.productVariantId,
          mixVariantId,
          component.quantity,
          tx
        );
      });
      await Promise.all(componentPromises);
      await this.productVariantRepository.recalculateSingleMixPrice(
        mixVariantId,
        tx
      );
      }
    } catch (error: any) {
      throw new ServerError("handleVariantsUpdate", error);
    }
  }

  // Actualiza situaciones de stock y precio relacionadas con el stock de un mix, y el precio de sus componentes
  async mixRelatedStockQueries(
    requestData: any,
    id: number,
    updatedVariant: any,
    tx?: any
  ) {
    try {

      if (
        (requestData.price || requestData.profitMargin) &&
        updatedVariant.isComponentOf &&
        updatedVariant.isComponentOf.length > 0
      ) {
        await this.productVariantRepository.recalculateAllMixesFromProduct(
          Number(id),
          tx
        );
      }
      if (requestData.stockIncrement) {
        if (
          requestData.stockIncrement > 0 &&
          updatedVariant.hasComponents &&
          updatedVariant.hasComponents.length > 0
        ) {
          await this.productVariantRepository.processMixProduction(
            Number(id),
            requestData.stockIncrement,
            tx
          );
        } else {
          await this.productVariantRepository.createStockMovement(
            Number(id),
            requestData.stockIncrement,
            requestData.stockIncrement < 0 ? "OUT" : "IN",
            tx
          );
        }
      }

      if (requestData.currentStock) {
        await this.productVariantRepository.processMixProduction(
          Number(id),
          requestData.currentStock,
          tx
        );
      }
    } catch (error: any) {
      throw new ServerError("mixRelatedStockQueries", error);
    }
  }
}
