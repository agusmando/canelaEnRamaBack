export const orderItemSearchQueryMapping = {
  orderId: { field: "orderId", type: "number" },
  productVariantId: { field: "productVariantId", type: "number" },
  productNameSnapshot: { field: "productNameSnapshot", type: "string" },
  variantNameSnapshot: { field: "variantNameSnapshot", type: "string" },
  status: { field: "status", type: "enum" },
  awaitingStockAt: { field: "awaitingStockAt", type: "date", operation: "gte" },
};
