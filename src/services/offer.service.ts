import { CreateOfferDto } from "../dto/offer/create-offer.dto.js";
import { OfferDto } from "../dto/offer/offer.dto.js";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { prisma } from "../config/prisma/client.js";

export const DISCOUNT_TYPES = [
  "PERCENTAGE",
  "FIXED",
  "BUY_ONE_GET_MORE",
  "BUY_MORE_GET_MORE",
  "BUY_MORE_GET_DISCOUNT",
  "BUY_MORE_GET_FIXED_DISCOUNT",
] as const;

export type OfferResult = { unitAfter: number; offerType: string };

/**
 * Ofertas: CRUD + cálculo del precio unitario con descuento.
 *
 * Semántica de cada tipo (quantity está en unidades de precio: kg o unidades):
 *   PERCENTAGE                   discountValue% off (0-100)
 *   FIXED                        -$discountValue por unidad
 *   BUY_ONE_GET_MORE / _MORE     lleva discountQuantity, paga quantityToGet (ej. 3x2)
 *   BUY_MORE_GET_DISCOUNT        desde discountQuantity, discountValue% off
 *   BUY_MORE_GET_FIXED_DISCOUNT  desde discountQuantity, -$discountValue por unidad
 */
export class OfferService extends GenericServiceImpl<OfferDto, CreateOfferDto, UpdateOfferDto> {
  constructor() {
    super("offer");
  }

  async create(data: CreateOfferDto): Promise<any> {
    this.validateOffer(data);

    if (data.productVariantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: Number(data.productVariantId) },
        select: { stockThreshold: true },
      });
      if (!variant) throw new NotFoundError("La variante de la oferta no existe");
      // La oferta nunca puede bajar el umbral de stock de la variante
      if (data.stockThreshold != null && variant.stockThreshold > Number(data.stockThreshold)) {
        data.stockThreshold = variant.stockThreshold;
      }
    }
    return super.create(data);
  }

  async update(id: number, data: UpdateOfferDto): Promise<any> {
    const current: any = await this.findOne(id);
    this.validateOffer({ ...current, ...data });
    return super.update(id, data);
  }

  private validateOffer(data: Partial<CreateOfferDto>) {
    const hasProduct = data.productId != null && data.productId !== ("" as any);
    const hasVariant = data.productVariantId != null && data.productVariantId !== ("" as any);
    if (hasProduct === hasVariant) {
      throw new ValidationError("La oferta debe aplicar a un productId O a un productVariantId");
    }
    if (!DISCOUNT_TYPES.includes(data.discountType as any)) {
      throw new ValidationError(`discountType debe ser uno de ${DISCOUNT_TYPES.join(", ")}`);
    }
    const start = new Date(data.startTime as any);
    const finish = new Date(data.finishTime as any);
    if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime()) || finish <= start) {
      throw new ValidationError("startTime y finishTime deben ser fechas válidas y finishTime > startTime");
    }
    const value = Number(data.discountValue);
    if (["PERCENTAGE", "BUY_MORE_GET_DISCOUNT"].includes(data.discountType!)) {
      if (!(value > 0 && value <= 100)) {
        throw new ValidationError("discountValue debe estar entre 0 y 100 para descuentos porcentuales");
      }
    }
    if (["FIXED", "BUY_MORE_GET_FIXED_DISCOUNT"].includes(data.discountType!) && !(value > 0)) {
      throw new ValidationError("discountValue debe ser mayor a 0");
    }
    if (["BUY_ONE_GET_MORE", "BUY_MORE_GET_MORE"].includes(data.discountType!)) {
      const take = Number(data.discountQuantity);
      const pay = Number(data.quantityToGet);
      if (!(take > 0 && pay > 0 && pay < take)) {
        throw new ValidationError(
          "Para NxM: discountQuantity (lleva) y quantityToGet (paga) > 0 y quantityToGet < discountQuantity",
        );
      }
    }
    if (["BUY_MORE_GET_DISCOUNT", "BUY_MORE_GET_FIXED_DISCOUNT"].includes(data.discountType!)) {
      if (!(Number(data.discountQuantity) > 0)) {
        throw new ValidationError("discountQuantity es requerido para descuentos por cantidad");
      }
    }
  }

  /** Aplica una oferta ya validada como vigente. */
  applyOffer(currentPrice: number, quantity: number, offer: OfferDto): OfferResult {
    switch (offer.discountType) {
      case "PERCENTAGE":
        return this.percentageDiscount(currentPrice, offer);
      case "FIXED":
        return this.fixedDiscount(currentPrice, offer);
      case "BUY_ONE_GET_MORE":
      case "BUY_MORE_GET_MORE":
        return this.buyXPayY(currentPrice, offer, quantity);
      case "BUY_MORE_GET_DISCOUNT":
        return this.buyXGetDiscount(currentPrice, offer, quantity, "PERCENTAGE");
      case "BUY_MORE_GET_FIXED_DISCOUNT":
        return this.buyXGetDiscount(currentPrice, offer, quantity, "FIXED");
      default:
        throw new ValidationError(`Unsupported discount type: ${offer.discountType}`);
    }
  }

  // 1. Descuento porcentual simple (ej. 10% off)
  percentageDiscount(currentPrice: number, offer: OfferDto): OfferResult {
    const pct = Number(offer.discountValue ?? 0);
    if (pct < 0 || pct > 100) {
      throw new ValidationError("Discount percentage must be between 0 and 100");
    }
    return { unitAfter: currentPrice * (1 - pct / 100), offerType: pct + "%" };
  }

  // 2. Descuento fijo simple (ej. $100 off)
  fixedDiscount(currentPrice: number, offer: OfferDto): OfferResult {
    const discount = Number(offer.discountValue ?? 0);
    return { unitAfter: Math.max(0, currentPrice - discount), offerType: "-$" + discount };
  }

  // 3. "Lleva X y paga Y" (ej. 3x2: discountQuantity = 3, quantityToGet = 2)
  buyXPayY(currentPrice: number, offer: OfferDto, quantity: number): OfferResult {
    const take = Number(offer.discountQuantity) || 1;
    const pay = Number(offer.quantityToGet) || take;
    if (quantity < take) return { unitAfter: currentPrice, offerType: "" };

    const sets = Math.floor(quantity / take);
    const remainder = quantity - sets * take;
    const total = (sets * pay + remainder) * currentPrice;
    return { unitAfter: total / quantity, offerType: take + "x" + pay };
  }

  // 4. "A partir de X cantidad, aplica descuento" en cada unidad
  buyXGetDiscount(
    currentPrice: number,
    offer: OfferDto,
    quantity: number,
    mode: "PERCENTAGE" | "FIXED",
  ): OfferResult {
    const requiredQty = Number(offer.discountQuantity) || 0;
    if (quantity < requiredQty) return { unitAfter: currentPrice, offerType: "" };

    const { unitAfter } =
      mode === "PERCENTAGE"
        ? this.percentageDiscount(currentPrice, offer)
        : this.fixedDiscount(currentPrice, offer);
    const offerType =
      mode === "PERCENTAGE"
        ? requiredQty + "x" + offer.discountValue + "%"
        : requiredQty + "x-$" + offer.discountValue;
    return { unitAfter, offerType };
  }
}
