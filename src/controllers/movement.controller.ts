import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { StockMovementService } from "../services/stockMovement.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";
import { BaseResponse } from "../utils/responseFormat.js";

export class MovementController extends GenericControllerImpl<
  MovementDto,
  CreateMovementDto,
  CreateMovementDto
> {
  readonly movementService: StockMovementService;

  constructor(movementService = new StockMovementService()) {
    super(movementService);
    this.movementService = movementService;
  }

  async createBulk(req: any, res: any, next: any) {
    try {
      const response = await this.movementService.createBulk(req.body);
      res.status(201).json(new BaseResponse(201, "Stock movements created", response));
    } catch (error) {
      next(error);
    }
  }
}
