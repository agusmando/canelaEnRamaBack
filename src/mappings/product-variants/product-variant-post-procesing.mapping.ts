import { ProductVariantDto } from "../../dto/product-variant/product-variant.dto.js";
import { OfferDto } from "../../dto/offer/offer.dto.js";
import { computeFinalPrice } from "../../utils/pricing.js";
import { PricingService } from "../../services/pricing.service.js";

const pricing = new PricingService();

/**
 * Agrega a la variante su precio de venta (`finalPrice`) y, si las ofertas
 * vinieron incluidas en la consulta, la oferta vigente (`activeOffer`) y el
 * precio con descuento por kg/u (`offerPrice`).
 * @param productOffers ofertas del producto padre (cuando la variante viene dentro del producto)
 */
export const productVariantPostProcessingMapping = (
  variant: ProductVariantDto,
  productOffers?: OfferDto[],
): ProductVariantDto => {
  if (!variant) return variant;
  const v: any = variant;
  const finalPrice = computeFinalPrice(variant);
  // Productor local: la variante manda; si no lo define, el producto (si vino incluido)
  const local = v.isLocal ?? (v.product ? !!v.product.isLocal : undefined);
  const extra = local === undefined ? {} : { local };
  const offersLoaded = Array.isArray(v.offers) || Array.isArray(productOffers) || Array.isArray(v.product?.offers);
  if (!offersLoaded) return { ...variant, finalPrice, ...extra } as any;
  return { ...variant, finalPrice, ...extra, ...pricing.variantOffer(v, productOffers) } as any;
};
