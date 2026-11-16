import { ProductVariantDto } from "../../dto/product-variant/product-variant.dto.js";
import { CreateProductVariantDto } from "../../dto/product-variant/create-product-variant.dto.js";
import { UpdateProductVariantDto } from "../../dto/product-variant/update-product-variant.dto.js";

export class ProductVariantMapper {
  static toDto(dbVariant: any): ProductVariantDto {
    if (!dbVariant) return dbVariant;

    let finalPrice: number | undefined;
    if (dbVariant.price != null && dbVariant.profitMargin != null) {
      const rounding = dbVariant.roundingOption ?? 10;
      const rawPrice = dbVariant.price * dbVariant.profitMargin + dbVariant.price;
      finalPrice = Math.ceil(rawPrice / rounding) * rounding;
    }

    return new ProductVariantDto(
      dbVariant.id,
      dbVariant.name,
      dbVariant.active,
      dbVariant.productId,
      dbVariant.currentStock,
      dbVariant.packagingOptions ? dbVariant.packagingOptions.map(Number) : [],
      dbVariant.requestTime ?? "",
      dbVariant.availableWeb,
      dbVariant.stockThreshold ?? 0,
      dbVariant.availablePedidosYa,
      dbVariant.roundingOption ?? 10,
      dbVariant.contentMeasure,
      dbVariant.profitMargin,
      dbVariant.price,
      dbVariant.product ? dbVariant.product : undefined,
      dbVariant.isComponentOf,
      dbVariant.hasComponents,
      dbVariant.movements,
      dbVariant.offers,
      finalPrice
    );
  }

  static toPrismaCreate(dto: CreateProductVariantDto): any {
    const data: any = {
      name: dto.name,
      price: Number(dto.price),
      profitMargin: Number(dto.profitMargin ?? 0),
      currentStock: Number(dto.currentStock ?? 0),
      active: dto.active !== undefined ? Boolean(dto.active) : true,
      availableWeb: dto.availableWeb !== undefined ? Boolean(dto.availableWeb) : true,
      availablePedidosYa: dto.availablePedidosYa !== undefined ? Boolean(dto.availablePedidosYa) : true,
      contentMeasure: dto.contentMeasure || "KG",
      roundingOption: Number(dto.roundingOption ?? 10),
      packagingOptions: dto.packagingOptions ? dto.packagingOptions.map(Number) : [],
      requestTime: dto.requestTime ?? "",
      stockThreshold: Number(dto.stockThreshold ?? 0),
    };

    if (dto.productId) {
      data.product = { connect: { id: Number(dto.productId) } };
    }

    if (dto.hasComponents && dto.hasComponents.length > 0) {
      data.hasComponents = {
        create: dto.hasComponents.map((component) => ({
          productVariantId: Number(component.productVariantId),
          quantity: Number(component.quantity),
        })),
      };
    }

    return data;
  }

  static toPrismaUpdate(dto: UpdateProductVariantDto): any {
    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = Number(dto.price);
    if (dto.profitMargin !== undefined) data.profitMargin = Number(dto.profitMargin);
    if (dto.currentStock !== undefined) data.currentStock = Number(dto.currentStock);
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    if (dto.availableWeb !== undefined) data.availableWeb = Boolean(dto.availableWeb);
    if (dto.availablePedidosYa !== undefined) data.availablePedidosYa = Boolean(dto.availablePedidosYa);
    if (dto.contentMeasure !== undefined) data.contentMeasure = dto.contentMeasure;
    if (dto.roundingOption !== undefined) data.roundingOption = Number(dto.roundingOption);
    if (dto.packagingOptions !== undefined) data.packagingOptions = dto.packagingOptions.map(Number);
    if (dto.requestTime !== undefined) data.requestTime = dto.requestTime;
    if (dto.stockThreshold !== undefined) data.stockThreshold = Number(dto.stockThreshold);

    return data;
  }
}
