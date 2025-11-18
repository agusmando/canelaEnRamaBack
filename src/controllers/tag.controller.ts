import { CreateTagDto } from "../dto/tags/create-tag.dto.ts";
import { TagDto } from "../dto/tags/tag.dto.ts";
import { UpdateTagDto } from "../dto/tags/update-tag.dto.ts";
import { GenericControllerImpl } from "./generic-controller-impl.controller.ts";

// const tagService = new TagService();

export class TagController extends GenericControllerImpl<TagDto, CreateTagDto, UpdateTagDto> {
  constructor() {
    super("tag")
  }
}