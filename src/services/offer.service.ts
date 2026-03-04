import { CreateOfferDto } from "../dto/offer/create-offer.dto.ts";
import { OfferDto } from "../dto/offer/offer.dto.ts";
import { UpdateOfferDto } from "../dto/offer/update-offer.dto.ts";
import { ValidationError } from "../errors/application/ValidationError.ts";
import { GenericServiceImpl } from "./generic-impl.service.ts";
import { ProductVariantService } from "./product-variant.service.ts";

export class OfferService extends GenericServiceImpl<
  OfferDto,
  CreateOfferDto,
  UpdateOfferDto
> {
  private productVariantService: ProductVariantService
  constructor() {
    super("offer");
    this.productVariantService = new ProductVariantService();
  }

  async create(data: CreateOfferDto) {
    try {
      if (data.productVariantId) {
        const productVariant = await this.productVariantService.findOne(
          data.productVariantId,
        );
        if (data.stockThreshold && productVariant.stockThreshold > data.stockThreshold) {
          data.stockThreshold = productVariant.stockThreshold;
        }
      }
      return await super.create(data);
    } catch (error) {
      throw error;
    }
  }


  args: { currentPrice: number; offer: OfferDto; quantity?: number } | null =
    null;

  discountTypesToFunction: any = {
    PERCENTAGE: (currentPrice: number, offer: OfferDto) =>
      this.percentageDiscount(currentPrice, offer),
    FIXED: (currentPrice: number, offer: OfferDto) =>
      this.fixedDiscount(currentPrice, offer),
    BUY_ONE_GET_MORE: (
      currentPrice: number,
      offer: OfferDto,
      quantity: number,
    ) => this.buyXGetX(currentPrice, offer, quantity),
    BUY_MORE_GET_DISCOUNT: (
      currentPrice: number,
      offer: OfferDto,
      quantity: number,
    ) => this.buyXGetDiscount(currentPrice, offer, quantity, "PERCENTAGE"),
    BUY_MORE_GET_FIXED_DISCOUNT: (
      currentPrice: number,
      offer: OfferDto,
      quantity: number,
    ) => this.buyXGetDiscount(currentPrice, offer, quantity, "FIXED"),
    BUY_MORE_GET_MORE: (
      currentPrice: number,
      offer: OfferDto,
      quantity: number,
    ) => this.buyXGetX(currentPrice, offer, quantity),
  };

  applyOffer(
    currentPrice: number,
    quantity: number,
    currentStock: number,
    offers: OfferDto[],
  ) {
    if (offers && offers.length > 0) {
      const lastOffer = offers[offers.length - 1];
      const handler = this.discountTypesToFunction[lastOffer.discountType];

      if (
        lastOffer.stockThreshold !== undefined &&
        currentStock < lastOffer.stockThreshold
      ) {
        return currentPrice;
      }

      if (typeof handler !== "function") {
        throw new ValidationError(
          `Unsupported discount type: ${lastOffer.discountType}`,
        );
      }
      return handler(currentPrice, lastOffer, quantity);
    } else {
      throw new ValidationError("No offer found");
    }
  }

  // 1. Descuento porcentual simple (ej. 10% off)
  percentageDiscount(currentPrice: number, offer: OfferDto) {
    if (
      offer.discountValue === undefined ||
      offer.discountValue < 0 ||
      offer.discountValue > 100
    ) {
      throw new ValidationError(
        "Discount percentage must be between 0 and 100",
      );
    }
    return { 
      unitAfter: currentPrice * (1 - offer.discountValue / 100),
      offerType: offer.discountValue + "%" 
    };
  }

  // 2. Descuento fijo simple (ej. $100 off)
  fixedDiscount(currentPrice: number, offer: OfferDto) {
    const discount = offer.discountValue || 0;
    return {
      unitAfter: Math.max(0, currentPrice - discount),
      offerType: "$" + discount,
    };
  }

  // 3. Lógica para "Lleva X y paga Y" (BUY_ONE_GET_MORE / BUY_MORE_GET_MORE)
  // Ejemplo: 3x2. Compras 3, pagas 2.
  // discountQuantity = 3 (lo que debe llevar), quantityToGet = 2 (lo que paga)
  buyXGetX(currentPrice: number, offer: OfferDto, quantity: number) {
    const reqQty = offer.discountQuantity || 1;
    const payQty = offer.quantityToGet || 1;

    if (quantity < reqQty) return currentPrice;

    const setsOfOffer = Math.floor(quantity / reqQty); //2
    const remainder = quantity % reqQty; //0

    const totalPrice =
      setsOfOffer * payQty * currentPrice + remainder * currentPrice;
    return {
      unitAfter: totalPrice / quantity,
      offerType: reqQty + "x" + payQty,
    }; // Retornamos el precio unitario promedio
  }

  // 4. Lógica para "A partir de X cantidad, aplica descuento"
  // Ejemplo: Llevando 5 o más, 20% de descuento en cada uno.
  buyXGetDiscount(
    currentPrice: number,
    offer: OfferDto,
    quantity: number,
    mode: "PERCENTAGE" | "FIXED",
  ) {
    const requiredQty = offer.discountQuantity || 0;

    if (quantity >= requiredQty) {
      const { unitAfter } = mode === "PERCENTAGE"
        ? this.percentageDiscount(currentPrice, offer)
        : this.fixedDiscount(currentPrice, offer);
      const offerType = mode === "PERCENTAGE" 
        ? requiredQty + "x" + offer.discountValue + "%" 
        : requiredQty + "x-$" + offer.discountValue;
      return { unitAfter, offerType };
    }
    

    return { unitPrice: currentPrice, offerType: "" };
  }
}
