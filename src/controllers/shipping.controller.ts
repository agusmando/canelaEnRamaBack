import { BadRequestError } from "../errors/application/BadRequestError.js";
import { BaseResponse } from "../utils/responseFormat.js";
import { getActor } from "../middleware/auth.middleware.js";
import { parseId } from "./generic-impl.controller.js";
import { ShippingService } from "../services/shipping.service.js";

export class ShippingController {
  constructor(private readonly shippingService = new ShippingService()) {}

  async config(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Shipping config", await this.shippingService.config()));
    } catch (error) {
      next(error);
    }
  }

  async listZones(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Shipping zones", await this.shippingService.listZones()));
    } catch (error) {
      next(error);
    }
  }

  async createZone(req: any, res: any, next: any) {
    try {
      const zone = await this.shippingService.createZone(req.body);
      res.status(201).json(new BaseResponse(201, "Shipping zone created", zone));
    } catch (error) {
      next(error);
    }
  }

  async updateZone(req: any, res: any, next: any) {
    try {
      const zone = await this.shippingService.updateZone(parseId(req.params.id), req.body);
      res.status(200).json(new BaseResponse(200, "Shipping zone updated", zone));
    } catch (error) {
      next(error);
    }
  }

  async getAddress(req: any, res: any, next: any) {
    try {
      const userId = getActor(req).userId;
      if (!userId) throw new BadRequestError("Se requiere una sesión para consultar el domicilio");
      res.status(200).json(new BaseResponse(200, "Shipping address", await this.shippingService.getAddress(userId)));
    } catch (error) {
      next(error);
    }
  }

  async saveAddress(req: any, res: any, next: any) {
    try {
      const userId = getActor(req).userId;
      if (!userId) throw new BadRequestError("Se requiere una sesión para guardar el domicilio");
      const address = await this.shippingService.saveAddress(userId, req.body);
      res.status(200).json(new BaseResponse(200, "Shipping address saved", address));
    } catch (error) {
      next(error);
    }
  }

  async quote(req: any, res: any, next: any) {
    try {
      const userId = getActor(req).userId;
      if (!userId) throw new BadRequestError("Se requiere una sesión para cotizar el envío");
      const quote = await this.shippingService.quote(userId, req.query.value);
      res.status(200).json(new BaseResponse(200, "Shipping quote", quote));
    } catch (error) {
      next(error);
    }
  }
}
