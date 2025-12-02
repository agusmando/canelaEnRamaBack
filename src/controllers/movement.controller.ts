import { CreateMovementDto } from "../dto/movement/create-movement.dto.ts";
import { MovementDto } from "../dto/movement/movement.dto.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

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
