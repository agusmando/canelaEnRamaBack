import { CreateTagDto } from "../dto/tags/create-tag.dto.js";
import { TagDto } from "../dto/tags/tag.dto.js";
import { UpdateTagDto } from "../dto/tags/update-tag.dto.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

// const tagService = new TagService();

export class TagController extends GenericControllerImpl<TagDto, CreateTagDto, UpdateTagDto> {
  constructor() {
    super("tag")
  }
}