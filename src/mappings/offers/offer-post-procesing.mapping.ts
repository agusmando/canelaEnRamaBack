import { OfferDto } from "../../dto/offer/offer.dto.js";

export const offerPostProcessingQueryMapping = (offer: OfferDto) => {
  let finalOffer = { ...offer };
  // if (!finalProduct.variants || finalProduct?.variants.length < 1)
  //   return finalProduct;
  // const variants: ProductVariantDto[] = finalProduct?.variants.map(
  //   (variant) => {
  //     if (!variant.price || !variant.profitMargin) return variant;
  //     variant.finalPrice = Math.round(
  //       Number(variant.price) * Number(variant.profitMargin) +
  //         Number(variant.price)
  //     );
  //     variant.profitMargin = 0;
  //     variant.price = 0;
  //     return variant;
  //   }
  // );
  // // .filter(Boolean);

  // finalProduct.variants = variants;
  // console.log(finalProduct.variants);
  return finalOffer;
};
