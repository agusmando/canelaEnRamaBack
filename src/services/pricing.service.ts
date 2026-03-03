import { OfferService } from "./offer.service.ts";

export type RoundingStrategy =
  | "NONE"
  | "DECADE"
  | "HUNDRED"
  | "CENT"
  | "CUSTOM";

export class PricingService {
  private offerService: OfferService;

  constructor() {
    this.offerService = new OfferService();
  }

  // calcula el precio base final del variant (price * profitMargin)
  //   computeBaseFinalPrice(productVariant: any): number {
  //     const price = Number(productVariant.price ?? 0);
  //     const profit = Number(productVariant.profitMargin ?? 1);
  //     return (price * profit) + price;
  //   }

  // aplica la oferta (usa OfferService) y devuelve unidad y total (offerService debe devolver precio unitario)
  applyOffers(
    baseUnitPrice: number,
    quantityPackages: number,
    currentStock: number,
    offers: any[],
  ) {
    if (!offers || offers.length === 0) {
      const total = baseUnitPrice * quantityPackages;
      return {
        unitPriceAfterOffer: baseUnitPrice,
        totalAfterOffer: total,
        discountApplied: 0,
        offerType: null,
      };
    }

    // OfferService.applyOffer actualmente devuelve unit price (o promedio). Ajustar si necesario.
    const unitAfter = this.offerService.applyOffer(
      baseUnitPrice,
      quantityPackages,
      currentStock,
      offers,
    );
    const total = unitAfter * quantityPackages;
    const discountApplied = Math.max(0, baseUnitPrice * quantityPackages - total);

    return {
      unitPriceAfterOffer: baseUnitPrice,
      totalAfterOffer: total,
      discountApplied
    };
  }

  // Aplica el redondeo según necesario
  applyRounding(value: number, strategy: RoundingStrategy): number {
    switch (strategy) {
      case "NONE":
        return value;
      case "DECADE":
        return Math.ceil(value / 10) * 10;
      case "HUNDRED":
        return Math.ceil(value / 100) * 100;
      default:
        return value;
    }
  }

  // main helper used by OrderService: recibe variant + cantidad (paquetes o unidades según tu dominio)
  async priceForOrderItem(args: {
    productVariant: any;
    requestedQuantity: number; // en "paquetes" como usas en el resto de tu lógica
    selectedBulkOption?: number; // packaging factor (si corresponde)
  }) {
    const { productVariant, requestedQuantity, selectedBulkOption } = args;

    // 1) calcular base por paquete
    const baseUnitPrice = productVariant.finalPrice || 0;

    // 2) Normalizar cantidad según packaging si es necesario (mantener la misma semántica que computeFulfillment)
    const measureContent = productVariant.measureContent;
    const processedQuantity =
      measureContent == "KG" ? requestedQuantity / 1000 : requestedQuantity; // Si es kilogramos, dividir gramos por mil
    let finalQuantity = selectedBulkOption // Si viene empaquetado, multiplicamos por la cantidad requerida
      ? processedQuantity * selectedBulkOption
      : processedQuantity;

    // 3) aplicar ofertas
    const offerResult = this.applyOffers(
      baseUnitPrice,
      Number(finalQuantity || 0),
      Number(productVariant.currentStock || 0),
      productVariant.offers || [],
    );

    const offerTypeSnapshot = this.offerEvaluationAndProcessing(productVariant);

    // 4) aplicar redondeo al precio unitario final (o al precio por kilo/unidad, según decidas)
    // const roundedUnit = this.applyRounding(
    //   offerResult.unitPriceAfterOffer,
    //   roundingStrategy,
    //   roundingGranularity,
    // );
    // const roundedTotal = this.applyRounding(
    //   roundedUnit * quantityPackages,
    //   roundingStrategy,
    //   roundingGranularity,
    // );

    return {
      unitPriceSnapshot: offerResult.unitPriceAfterOffer, //roundedUnit,
      totalPriceSnapshot: offerResult.totalAfterOffer, // roundedTotal,  CAMBIAR CUANDO ESTÉ EL ROUNDING LISTO
      discountAppliedSnapshot: offerResult.discountApplied,
      offerTypeSnapshot: offerTypeSnapshot,
      rawUnitPriceBeforeRounding: offerResult.unitPriceAfterOffer,
      rawTotalBeforeRounding: offerResult.totalAfterOffer,
    };
  }

  offerEvaluationAndProcessing(productVariant: any) {
    let offerTypeSnapshot = null;

    if (!productVariant.offers || productVariant.offers.length === 0) {
      return;
    }

    const knowkDiscountValue = [
      "FIXED",
      "PERCENTAGE",
      "BUY_MORE_GET_DISCOUNT",
      "BUY_MORE_GET_FIXED_DISCOUNT",
    ]; //con discountValue
    const knownQuantityToGet = ["BUY_ONE_GET_MORE", "BUY_MORE_GET_MORE"]; //Con quantityToGet y unitPriceSnapshot

    const selectedOffer =
      productVariant.offers[productVariant.offers.length - 1];
    const minimumQuantity = Number(selectedOffer.discountQuantity ?? 0);

    if (productVariant.currentStock < selectedOffer.stockThreshold) {
      return;
    }

    if (knownQuantityToGet.includes(selectedOffer.discountType)) {
      // if ()

      const giftedQuantity = Number(selectedOffer.quantityToGet ?? 0);
      offerTypeSnapshot =
        giftedQuantity + minimumQuantity + "x" + minimumQuantity; //2x1, 3x2, etc
    }
    if (knowkDiscountValue.includes(selectedOffer.discountType)) {
      const discountValue = Number(selectedOffer.discountValue ?? 0);
      if (selectedOffer.discountType === "PERCENTAGE") {
        offerTypeSnapshot = discountValue + "%";
      }
      if (selectedOffer.discountType === "FIXED") {
        offerTypeSnapshot = "$" + discountValue;
      }
      if (selectedOffer.discountType === "BUY_MORE_GET_DISCOUNT") {
        offerTypeSnapshot = minimumQuantity + "x" + discountValue + "%";
      }
      if (selectedOffer.discountType === "BUY_MORE_GET_FIXED_DISCOUNT") {
        offerTypeSnapshot = minimumQuantity + "x-$" + discountValue;
      }
    }

    return offerTypeSnapshot
  }
}
