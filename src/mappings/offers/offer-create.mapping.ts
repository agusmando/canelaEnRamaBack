export const offerCreateMapping = {
  ProductVariant: { relation: true, connectField: "id", allowCreate: false },
  Product: { relation: true, connectField: "id", allowCreate: false },
  productVariantId: { parseInt: true },
  productId: { parseInt: true },
  active: { parseBoolean: true },
  discountValue: { parseInt: true },
  // discountType: { parseInt: true },
  discountQuantity: { parseInt: true },
  quantityToGet: { parseInt: true },
  stockThreshold: { parseInt: true },
};
