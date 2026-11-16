import { CreateOfferDto } from "../dto/offer/create-offer.dto.js";
import { OfferDto } from "../dto/offer/offer.dto.js";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.js";
import { OfferService } from "../services/offer.service.js";
import { GenericControllerImpl } from "./generic-impl.controller.js";

/** create/update heredados: el servicio valida la oferta antes de guardar. */
export class OfferController extends GenericControllerImpl<OfferDto, CreateOfferDto, UpdateOfferDto> {
  constructor(offerService = new OfferService()) {
    super(offerService);
  }
}
