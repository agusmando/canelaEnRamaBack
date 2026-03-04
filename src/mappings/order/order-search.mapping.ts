

export const orderSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  ofuscatedUser: { field: "user", type: "object"},
  userSuperTokensId: { field: "userSuperTokensId", type: "string" },
  ofuscatedItems: { field: "orderItems", type: "relationArray", childField: "id", expand: ["productVariant"] },
  createdAt: { field: "createdAt", type: "date", operation: "gte" },
  updatedAt: { field: "updatedAt", type: "date", operation: "gte" },
  status: { field: "status", type: "enum" },
  paymentType: { field: "paymentType", type: "string" },
  totalPrice: { field: "totalPrice", type: "number", operation: "gte" },
  totalItems: { field: "totalItems", type: "number", operation: "gte" },
  estimatedReadyAt: { field: "estimatedReadyAt", type: "date", operation: "gte" },
};
