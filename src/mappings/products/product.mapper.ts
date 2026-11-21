import { ProductDto } from "../../dto/products/product.dto.js";
import { CreateProductDto } from "../../dto/products/create-product.dto.js";
import { UpdateProductDto } from "../../dto/products/update-product.dto.js";
import { ProductVariantMapper } from "../product-variants/product-variant.mapper.js";

export class ProductMapper {
  static toDto(dbProduct: any): ProductDto {
    if (!dbProduct) return dbProduct;

    const variants = dbProduct.variants
      ? dbProduct.variants.map((v: any) => ProductVariantMapper.toDto(v))
      : [];

    return new ProductDto(
      dbProduct.name,
      dbProduct.description ?? "",
      dbProduct.active,
      dbProduct.brandId ?? 0,
      dbProduct.categoryId,
      variants,
      dbProduct.finalPrice,
      dbProduct.measure,
      dbProduct.Category ? dbProduct.Category : undefined,
      dbProduct.Tags ? dbProduct.Tags : []
    );
  }

  static toPrismaCreate(dto: CreateProductDto): any {
    const data: any = {
      name: dto.name,
      description: dto.description ?? "",
      measure: dto.measure || "KG",
      Category: { connect: { id: Number(dto.categoryId) } },
      Brand: { connect: { id: Number(dto.brandId) } },
    };

    if (dto.Tags && dto.Tags.length > 0) {
      data.Tags = {
        connect: dto.Tags.map((tag: any) => ({ id: Number(tag.id || tag) })),
      };
    }

    return data;
  }

  static toPrismaUpdate(dto: UpdateProductDto): any {
    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    if (dto.measure !== undefined) data.measure = dto.measure;
    
    if (dto.categoryId !== undefined) {
      data.Category = { connect: { id: Number(dto.categoryId) } };
    }
    if (dto.brandId !== undefined) {
      data.Brand = { connect: { id: Number(dto.brandId) } };
    }

    return data;
  }
}
