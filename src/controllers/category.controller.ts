import { CategoryDto } from "../dto/category/category.dto.ts";
import { CreateCategoryDto } from "../dto/category/create-category.dto.ts";
import { UpdateCategoryDto } from "../dto/category/update-category.dto.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";
export class CategoryController extends GenericControllerImpl<CategoryDto, CreateCategoryDto, UpdateCategoryDto> {
  constructor() {
    super("category");
  }
}