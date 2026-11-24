import { CategoryDto } from "../dto/category/category.dto.js";
import { CreateCategoryDto } from "../dto/category/create-category.dto.js";
import { UpdateCategoryDto } from "../dto/category/update-category.dto.js";
import { GenericServiceImpl } from "./generic-impl.service.js";

/** Categorías: listado cacheado (cambian raro; las escrituras lo invalidan). */
export class CategoryService extends GenericServiceImpl<CategoryDto, CreateCategoryDto, UpdateCategoryDto> {
  constructor() {
    super("category");
  }

  protected override listCacheTtlMs = 5 * 60 * 1000;
  protected override listCachePrefix = "category";
}
