export const cartSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  ofuscatedQuantity: { field: "quantity", type: "number" },
  ofuscatedSessionId: { field: "sessionId", type: "number" },
  ofuscatedProductVariant: { field: "productVariant", type: "relationArray", childField: "id", expand: ["hasComponents", "isComponentOf"] },
  createdAt: { field: "createdAt", type: "date", operation: "gte" },
  updatedAt: { field: "updatedAt", type: "date", operation: "gte" },
};
