import { StockMovementRepository } from './../repository/stockMovement.repository.js';
import { CreateProductVariantDto } from "../dto/product-variant/create-product-variant.dto.js";
import { ProductVariantDto } from "../dto/product-variant/product-variant.dto.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { UpdateProductVariantDto } from "../dto/product-variant/update-product-variant.dto.js";
import { productVariantPostProcessingMapping } from "../mappings/product-variants/product-variant-post-procesing.mapping.js";
import { ProductVariantRepository } from "../repository/product-variant.repository.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { ImageService } from "./image.service.js";
import { ServerError } from "../errors/application/ServerError.js";
import { StoreProcedureError } from '../errors/infra/StoreProcedureError.js';

export class ProductVariantService extends GenericServiceImpl<
  ProductVariantDto,
  CreateProductVariantDto,
  UpdateProductVariantDto
> {
  imageService: ImageService;
  productVariantRepository: ProductVariantRepository;
  stockMovementRepository: StockMovementRepository;
  constructor() {
    super("productVariant");
    this.productVariantRepository = new ProductVariantRepository();
    this.stockMovementRepository = new StockMovementRepository();
    this.imageService = new ImageService();
  }

  async createVariant(
    createData: CreateProductVariantDto,
    uploadedFilesByField: any[],
    tx?: any
  ): Promise<ProductVariantDto> {
    
    return this.productVariantRepository.withTransaction(async (tx) => {
      if (!createData) {
        uploadedFilesByField &&
          (await this.imageService.abortImageUpload(uploadedFilesByField));
        throw new BadRequestError();
      }
      if (createData.productId == 0 || !createData.productId) {
        uploadedFilesByField &&
          (await this.imageService.abortImageUpload(uploadedFilesByField));
        throw new BadRequestError();  
      }

      const stagedV = {
        name: createData.name,
        currentStock: createData.currentStock,
      }
      createData.currentStock = 0;
  
      const createdV = await this.productVariantRepository.createVariant(
        createData,
        uploadedFilesByField,
        tx
      );

      if (createdV.hasComponents && createdV.hasComponents.length > 0) {
        try {
          await this.productVariantRepository.recalculateSingleMixPrice(
            createdV.id,
            tx,
          );
          await this.stockMovementRepository.processMixProduction(
            createdV.id,
            stagedV.currentStock,
            tx,
          );
        } catch (error) {
          throw new StoreProcedureError(
            "recalculate_mix_price/process_mix_production",
            error,
          );
        }
      } else {
        if (createdV.name == stagedV.name) {
          console.log(
            "ingreso " + createdV.name + " " + createdV.currentStock,
          );
          await this.stockMovementRepository.createStockMovement(
            createdV.id,
            stagedV.currentStock,
            "IN",
            tx,
          );
        }
      }

      return createdV
    })
  }       

  async updateVariant(
    id: number,
    data: UpdateProductVariantDto,
    uploadedFilesByField: any[],
  ): Promise<ProductVariantDto> {
    const postMapping = productVariantPostProcessingMapping;

    
    return this.productVariantRepository.withTransaction(async (tx) => {
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
      await this.mixRelatedStockQueries(data, id, updatedVariant as any, tx);

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
      console.log('mixRelatedStockQueries', requestData, id, 'is ', updatedVariant.currentStock ? 'with currentStock' : 'with stockIncrement')

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
      if (requestData.currentStock) {
        if ( 
          requestData.currentStock > 0 && 
          updatedVariant.hasComponents &&
          updatedVariant.hasComponents.length > 0
        ) {
          await this.productVariantRepository.processMixProduction(
            Number(id),
            requestData.currentStock,
            tx
          );
        } else {
          console.log("requestData.currentStock", requestData.currentStock)
          await this.productVariantRepository.createStockMovement(
            Number(id),
            requestData.currentStock,
            "ADJUSTMENT",
            tx  
          )
        }
      }
      if (requestData.stockIncrement && !requestData.currentStock) {
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

    } catch (error: any) {
      throw new ServerError("mixRelatedStockQueries", error);
    }
  }
}
