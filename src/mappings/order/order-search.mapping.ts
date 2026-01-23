

export const cartSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  ofuscateduserSuperTokensId: { field: "userSuperTokensId", type: "string" },
  ofuscatedItems: { field: "orderItems", type: "relationArray", childField: "id", expand: ["productVariant"] },
  createdAt: { field: "createdAt", type: "date", operation: "gte" },
  updatedAt: { field: "updatedAt", type: "date", operation: "gte" },
  status: { field: "status", type: "string" },
  paymentType: { field: "paymentType", type: "string" },
  totalPrice: { field: "totalPrice", type: "number", operation: "gte" },
  totalItems: { field: "totalItems", type: "number", operation: "gte" },
  estimatedReadyAt: { field: "estimatedReadyAt", type: "date", operation: "gte" },
};
