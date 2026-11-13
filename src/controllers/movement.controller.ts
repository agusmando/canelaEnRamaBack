import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { StockMovementService } from "../services/stockMovement.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

export class MovementController extends GenericControllerImpl<
  MovementDto,
  CreateMovementDto,
  CreateMovementDto
> {
  constructor() {
    super(new StockMovementService());
  }
}
