import { CreateOfferDto } from "../dto/offer/create-offer.dto.ts";
import { OfferDto } from "../dto/offer/offer.dto.ts";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.ts";
import { OfferService } from "../services/offer.service.ts";
import { GenericControllerImpl } from "./generic-impl.controller.ts";

const offerService = new OfferService();

export class OfferController extends GenericControllerImpl<
  OfferDto,
  CreateOfferDto,
  UpdateOfferDto
> {
  constructor() {
    super("offer");
  }
}
