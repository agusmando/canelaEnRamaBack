import { ProductVariantDto } from "../../dto/product-variant/product-variant.dto.js";

export const productVariantPostProcessingMapping = (
  product: ProductVariantDto,
): ProductVariantDto => {
  let finalVariant = { ...product };
  if (!finalVariant.price || !finalVariant.profitMargin) {
    return finalVariant;
  }
  const rawPrice =
    finalVariant.price * finalVariant.profitMargin + finalVariant.price;
  const roundingOption = finalVariant.roundingOption;
  finalVariant.finalPrice =
    Math.ceil(rawPrice / roundingOption) * roundingOption;
  // const { profitMargin, price, ...rest } = finalVariant;
  return finalVariant;
};

// export const productVariantStockMovement = (
//   movementType: string,
//   price: number,
//   quantity: number,
// ): any => {
//   const options = {
//     stockIncrement: {
//       currentStock: { increment: quantity },

//       movements: {
//         create: {
//           priceAtTime: price,
//           quantity: qty,
//           type: fullData.movementType || (qty < 0 ? "OUT" : "IN"),
//         },
//       },
//     },
//     currentStock: {
//       currentStock: finalValue,

//       movements: {
//         create: {
//           priceAtTime: price,
//           quantity: finalValue,
//           type: fullData.movementType || "ADJUSTMENT",
//         },
//       },
//     },
//   };
//   return options[movementType];
// };
