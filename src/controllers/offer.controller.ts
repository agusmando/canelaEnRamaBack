import { CreateOfferDto } from "../dto/offer/create-offer.dto.js";
import { OfferDto } from "../dto/offer/offer.dto.js";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.js";
import { OfferService } from "../services/offer.service.js";
import { BaseResponse } from "../utils/responseFormat.js";
// import { OfferService } from "../services/offer.service.js";s
import { GenericControllerImpl } from "./generic-impl.controller.js";


export class OfferController extends GenericControllerImpl<
  OfferDto,
  CreateOfferDto,
  UpdateOfferDto
> {
  offerService: OfferService;
  constructor() {
    super("offer");
    this.offerService = new OfferService();
  }

  async create(req: any, res: any, next: any) {
    try {
      const data = req.body;
      const response = await this.offerService.create(data);
      res.status(200).json(new BaseResponse(200, "Offer created", response));
    } catch (error) {
      next(error);
    }
  }
}
