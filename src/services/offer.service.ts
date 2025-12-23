import { PrismaClient } from "@prisma/client";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { OfferDto } from "../dto/offer/offer.dto.ts";
import { CreateOfferDto } from "../dto/offer/create-offer.dto.ts";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.ts";

export class OfferService extends GenericServiceImpl<
  OfferDto,
  CreateOfferDto,
  UpdateOfferDto
> {
  protected prisma: PrismaClient;

  constructor() {
    super("offer");
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
}
