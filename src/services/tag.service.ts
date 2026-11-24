import { CreateTagDto } from "../dto/tags/create-tag.dto.js";
import { TagDto } from "../dto/tags/tag.dto.js";
import { UpdateTagDto } from "../dto/tags/update-tag.dto.js";
import { GenericServiceImpl } from "./generic-impl.service.js";

/** Etiquetas: listado cacheado (cambian raro; las escrituras lo invalidan). */
export class TagService extends GenericServiceImpl<TagDto, CreateTagDto, UpdateTagDto> {
  constructor() {
    super("tag");
  }

  protected override listCacheTtlMs = 5 * 60 * 1000;
  protected override listCachePrefix = "tag";
}
