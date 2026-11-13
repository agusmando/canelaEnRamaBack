import {
  CreateShipmentDto,
  ShipmentDto,
  UpdateShipmentDto,
} from "../dto/shipment/shipment.dto.js";
import { ShipmentService } from "../services/shipment.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { GenericControllerImpl, parseId } from "./generic-impl.controller.js";
import { getActor } from "../middleware/auth.middleware.js";

export class ShipmentController extends GenericControllerImpl<
  ShipmentDto,
  CreateShipmentDto,
  UpdateShipmentDto
> {
  readonly shipmentService: ShipmentService;

  constructor(shipmentService = new ShipmentService()) {
    super(shipmentService);
    this.shipmentService = shipmentService;
  }

  async meta(_req: any, res: any) {
    res.status(200).json(new BaseResponse(200, "Shipment meta", this.shipmentService.meta()));
  }

  async create(req: any, res: any, next: any) {
    try {
      const response = await this.shipmentService.createShipment(req.body);
      res.status(201).json(new BaseResponse(201, "Shipment created", response));
    } catch (error) {
      next(error);
    }
  }

  async update(req: any, res: any, next: any) {
    try {
      const response = await this.shipmentService.updateShipment(parseId(req.params.id), req.body);
      res.status(200).json(new BaseResponse(200, "Shipment updated", response));
    } catch (error) {
      next(error);
    }
  }

  async addEvent(req: any, res: any, next: any) {
    try {
      const response = await this.shipmentService.addEvent(parseId(req.params.id), req.body);
      res.status(201).json(new BaseResponse(201, "Shipment status updated", response));
    } catch (error) {
      next(error);
    }
  }

  async findByOrder(req: any, res: any, next: any) {
    try {
      const response = await this.shipmentService.findByOrder(
        parseId(req.params.orderId, "orderId"),
        getActor(req),
      );
      res.status(200).json(new BaseResponse(200, "Shipment found", response));
    } catch (error) {
      next(error);
    }
  }

  async track(req: any, res: any, next: any) {
    try {
      const response = await this.shipmentService.track(req.params.code);
      res.status(200).json(new BaseResponse(200, "Shipment found", response));
    } catch (error) {
      next(error);
    }
  }
}
