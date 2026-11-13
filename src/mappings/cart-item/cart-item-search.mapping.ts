export const cartItemSearchQueryMapping = {
  cartId: { field: "cartId", type: "number" },
  productVariantId: { field: "productVariantId", type: "number" },
  selectedBulkOption: { field: "selectedBulkOption", type: "number" },
  createdAt: { field: "createdAt", type: "date", operation: "gte" },
};
