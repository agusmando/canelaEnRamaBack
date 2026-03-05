import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

// const tagService = new TagService();

export class MovementController extends GenericControllerImpl<
  MovementDto,
  CreateMovementDto,
  CreateMovementDto
> {
  constructor() {
    super("stockMovement");
  }
}
