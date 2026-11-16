import { CategoryDto } from "../dto/category/category.dto.js";
import { CreateCategoryDto } from "../dto/category/create-category.dto.js";
import { UpdateCategoryDto } from "../dto/category/update-category.dto.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";
export class CategoryController extends GenericControllerImpl<CategoryDto, CreateCategoryDto, UpdateCategoryDto> {
  constructor() {
    super("category");
  }
}