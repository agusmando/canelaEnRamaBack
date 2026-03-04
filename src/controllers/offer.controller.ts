import { CreateOfferDto } from "../dto/offer/create-offer.dto.ts";
import { OfferDto } from "../dto/offer/offer.dto.ts";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.ts";
import { OfferService } from "../services/offer.service.ts";
import { BaseResponse } from "../utils/responseFormat.ts";
// import { OfferService } from "../services/offer.service.ts";s
import { GenericControllerImpl } from "./generic-impl.controller.ts";


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
