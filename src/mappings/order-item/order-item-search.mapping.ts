
export const orderSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  ofuscatedQuantity: { field: "quantity", type: "number" },
  ofuscatedProductVariant: {
    field: "productVariant",
    type: "relationArray",
    childField: "id",
    expand: ["product", "offers"],
  },
  ofuscatedOrder: { field: "order", type: "object", childField: "id" },

  productNameSnapshot: { field: "productNameSnapshot", type: "string" },
  variantNameSnapshot: { field: "variantNameSnapshot", type: "string" },
  unitPriceSnapshot: { field: "unitPriceSnapshot", type: "number" },
  status: { field: "status", type: "string" },
  awaitingStockAt: { field: "awaitingStockAt", type: "date", operation: "gte" },
};
