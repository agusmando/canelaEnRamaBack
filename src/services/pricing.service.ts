import { OfferDto } from "../dto/offer/offer.dto.ts";
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
    offers: OfferDto[],
    productOriginalStockThreshold: number,
  ) {
    const lastOffer = offers?.[offers.length - 1];
    const threshold =
      lastOffer?.stockThreshold && productOriginalStockThreshold
        ? Math.max(lastOffer.stockThreshold, productOriginalStockThreshold)
        : productOriginalStockThreshold || lastOffer?.stockThreshold;
    if (
      !offers ||
      offers.length === 0 ||
      !lastOffer ||
      lastOffer.active === false ||
      (threshold && currentStock < threshold) ||
      (lastOffer.finishTime && lastOffer.finishTime < new Date()) ||
      (lastOffer.startTime && lastOffer.startTime >= new Date())
    ) {
      const total = baseUnitPrice * quantityPackages;
      return {
        unitPriceAfterOffer: baseUnitPrice,
        totalAfterOffer: total,
        discountApplied: 0,
        offerType: null,
      };
    }

    // OfferService.applyOffer actualmente devuelve unit price (o promedio). Ajustar si necesario.
    const { unitAfter, offerType } = this.offerService.applyOffer(
      baseUnitPrice,
      quantityPackages,
      currentStock,
      offers,
    );
    const total = unitAfter * quantityPackages;
    const discountApplied = Math.max(
      0,
      baseUnitPrice * quantityPackages - total,
    );
    console.log("discountApplied", {
      unitPriceAfterOffer: baseUnitPrice,
      totalAfterOffer: total,
      discountApplied,
      offerType,
    });
    return {
      unitPriceAfterOffer: baseUnitPrice,
      totalAfterOffer: total ? total : baseUnitPrice * quantityPackages,
      discountApplied: discountApplied ? discountApplied : 0,
      offerType: offerType ? offerType : "",
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
    const contentMeasure = productVariant.contentMeasure;
    const processedQuantity =
      contentMeasure == "KG" ? requestedQuantity / 1000 : requestedQuantity; // Si es kilogramos, dividir gramos por mil
    let finalQuantity = selectedBulkOption // Si viene empaquetado, multiplicamos por la cantidad requerida
      ? processedQuantity * selectedBulkOption
      : processedQuantity;

    console.log(
      "productVariant",
      productVariant.offers,
      productVariant.product.offers,
    );

    // 3) aplicar ofertas

    const offers =
      productVariant.offers.length > 0
        ? productVariant.offers
        : productVariant.product.offers || [];

    const offerResult = this.applyOffers(
      baseUnitPrice,
      Number(finalQuantity || 0),
      Number(productVariant.currentStock || 0),
      offers,
      Number(productVariant.stockThreshold),
    );

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
      unitPriceSnapshot: offerResult.unitPriceAfterOffer ?? 0, //roundedUnit,
      totalPriceSnapshot: offerResult.totalAfterOffer ?? 0, // roundedTotal,  CAMBIAR CUANDO ESTÉ EL ROUNDING LISTO
      discountAppliedSnapshot: Math.ceil(offerResult.discountApplied) ?? 0,
      offerTypeSnapshot: offerResult.offerType ?? "",
      rawUnitPriceBeforeRounding: offerResult.unitPriceAfterOffer ?? 0,
      rawTotalBeforeRounding: offerResult.totalAfterOffer ?? 0,
    };
  }
}
