import { OfferDto } from "../dto/offer/offer.dto.js";
import { OfferService } from "./offer.service.js";
import { computeFinalPrice, stockUnitsToPriceUnits } from "../utils/pricing.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PriceQuote = {
  /** Precio de lista por unidad de precio (kg o unidad), ya redondeado. */
  unitPriceSnapshot: number;
  /** Total de la línea con descuento aplicado. */
  totalPriceSnapshot: number;
  /** Descuento total de la línea (en $). */
  discountAppliedSnapshot: number;
  offerTypeSnapshot: string;
  /** Cantidad expresada en unidades de precio (kg o unidades). */
  priceUnits: number;
};

/**
 * Cálculo de precios de venta. Única fuente para carrito, órdenes y catálogo.
 */
export class PricingService {
  constructor(private readonly offerService = new OfferService()) {}

  /**
   * Elige la oferta vigente que aplica: primero las de la variante, si no las
   * del producto. Entre las vigentes, la más reciente (mayor id).
   */
  selectOffer(
    variantOffers: OfferDto[] = [],
    productOffers: OfferDto[] = [],
    currentStock: number,
    variantStockThreshold: number,
    now = new Date(),
  ): OfferDto | undefined {
    const isValid = (offer: OfferDto) => {
      if (offer.active === false) return false;
      if (offer.startTime && new Date(offer.startTime) > now) return false;
      if (offer.finishTime && new Date(offer.finishTime) < now) return false;
      const threshold = Math.max(Number(offer.stockThreshold) || 0, variantStockThreshold || 0);
      // Si el stock cae por debajo del umbral, la oferta deja de aplicar
      return !(threshold > 0 && currentStock < threshold);
    };
    const pick = (offers: OfferDto[]) =>
      offers.filter(isValid).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    return pick(variantOffers) ?? pick(productOffers);
  }

  /**
   * Cotiza una línea.
   * @param quantity  paquetes si hay `selectedBulkOption`; si no, gramos (KG) o unidades.
   * @param selectedBulkOption tamaño del paquete en gramos/unidades.
   */
  quote(args: {
    productVariant: any;
    quantity: number;
    selectedBulkOption?: number | null;
  }): PriceQuote {
    const { productVariant, quantity, selectedBulkOption } = args;
    const unitPrice = computeFinalPrice(productVariant);

    const stockUnits = selectedBulkOption ? quantity * selectedBulkOption : quantity;
    const priceUnits = stockUnitsToPriceUnits(stockUnits, productVariant.contentMeasure);

    const offer = this.selectOffer(
      productVariant.offers,
      productVariant.product?.offers,
      Number(productVariant.currentStock ?? 0),
      Number(productVariant.stockThreshold ?? 0),
    );

    const listTotal = unitPrice * priceUnits;
    let total = listTotal;
    let offerType = "";
    if (offer && priceUnits > 0) {
      const result = this.offerService.applyOffer(unitPrice, priceUnits, offer);
      total = result.unitAfter * priceUnits;
      offerType = result.offerType;
    }

    return {
      unitPriceSnapshot: unitPrice,
      totalPriceSnapshot: round2(total),
      discountAppliedSnapshot: round2(Math.max(0, listTotal - total)),
      offerTypeSnapshot: offerType,
      priceUnits,
    };
  }

  /** Total de una línea de orden ya creada, a partir de sus snapshots. */
  lineTotal(item: {
    unitPriceSnapshot: number;
    discountAppliedSnapshot?: number | null;
    quantity: number;
    selectedBulkOption?: number | null;
    status?: string;
    productVariant?: { contentMeasure?: string | null } | null;
  }): number {
    if (item.status === "CANCELLED" || item.status === "RETURNED") return 0;
    const stockUnits = item.selectedBulkOption
      ? item.quantity * item.selectedBulkOption
      : item.quantity;
    const priceUnits = stockUnitsToPriceUnits(stockUnits, item.productVariant?.contentMeasure);
    return round2(
      Math.max(0, item.unitPriceSnapshot * priceUnits - Number(item.discountAppliedSnapshot ?? 0)),
    );
  }
}
