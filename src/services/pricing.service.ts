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

/** Oferta vigente de una variante, resumida para mostrar en catálogo y dashboard. */
export type ActiveOfferInfo = {
  id: number;
  scope: "VARIANT" | "PRODUCT";
  discountType: string;
  discountValue: number | null;
  discountQuantity: number | null;
  quantityToGet: number | null;
  finishTime: Date | null;
  /** Etiqueta corta: "20% off", "-$100", "3x2", "20% off desde 3". */
  label: string;
};

const fmtMoney = (n: number) => "$" + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function offerLabel(o: OfferDto): string {
  const value = Number(o.discountValue ?? 0);
  switch (o.discountType) {
    case "PERCENTAGE":
      return `${value}% off`;
    case "FIXED":
      return `-${fmtMoney(value)}`;
    case "BUY_ONE_GET_MORE":
    case "BUY_MORE_GET_MORE":
      return `${o.discountQuantity}x${o.quantityToGet}`;
    case "BUY_MORE_GET_DISCOUNT":
      return `${value}% off desde ${o.discountQuantity}`;
    case "BUY_MORE_GET_FIXED_DISCOUNT":
      return `-${fmtMoney(value)} desde ${o.discountQuantity}`;
    default:
      return "Oferta";
  }
}

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

  /**
   * Oferta vigente de una variante y su precio por unidad de precio (kg/u)
   * con la oferta aplicada a 1 unidad. `offerPrice` es null si la oferta
   * depende de la cantidad (ej. 3x2) o no baja el precio.
   */
  variantOffer(
    variant: any,
    productOffers?: OfferDto[],
  ): { activeOffer: ActiveOfferInfo | null; offerPrice: number | null } {
    const variantOffers: OfferDto[] = variant?.offers ?? [];
    const offer = this.selectOffer(
      variantOffers,
      productOffers ?? variant?.product?.offers ?? [],
      Number(variant?.currentStock ?? 0),
      Number(variant?.stockThreshold ?? 0),
    );
    if (!offer) return { activeOffer: null, offerPrice: null };
    const unitPrice = computeFinalPrice(variant);
    let offerPrice: number | null = null;
    if (unitPrice > 0) {
      const after = round2(this.offerService.applyOffer(unitPrice, 1, offer).unitAfter);
      if (after < unitPrice) offerPrice = after;
    }
    return {
      activeOffer: {
        id: offer.id,
        scope: variantOffers.some((o) => o.id === offer.id) ? "VARIANT" : "PRODUCT",
        discountType: offer.discountType,
        discountValue: offer.discountValue ?? null,
        discountQuantity: offer.discountQuantity ?? null,
        quantityToGet: offer.quantityToGet ?? null,
        finishTime: offer.finishTime ?? null,
        label: offerLabel(offer),
      },
      offerPrice,
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
