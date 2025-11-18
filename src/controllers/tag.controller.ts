import { TagDto } from "../dto/tags/tag.dto.ts";
import { TagService } from "../services/tag.service.ts";
import { GenericControllerImpl } from "./generic-controller-impl.controller.ts";

const tagService = new TagService();

// export class TagController extends GenericControllerImpl<TagDto> {
//   constructor() {
//     super()
//   }
// }