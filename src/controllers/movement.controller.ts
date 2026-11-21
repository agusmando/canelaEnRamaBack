import { BaseResponse } from "../utils/responseFormat.js";
import { CreateMovementDto } from "../dto/movement/create-movement.dto.js";
import { MovementDto } from "../dto/movement/movement.dto.js";
import { StockMovementService } from "../services/stockMovement.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

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

  /** POST /movement/bulk { movements: [{ productVariantId, type, quantity }] } */
  async createBulk(req: any, res: any, next: any) {
    try {
      const input = req.body?.movements ?? req.body;
      const result = await this.movementService.createBulk(input);
      res.status(201).json(new BaseResponse(201, `${result.count} movimientos registrados`, result));
    } catch (error) {
      next(error);
    }
  }
}
