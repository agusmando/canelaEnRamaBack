export const cartSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  ofuscateduserSuperTokensId: { field: "userSuperTokensId", type: "string" },
  ofuscatedSessionId: { field: "sessionId", type: "number" },
  ofuscatedItems: { field: "items", type: "relationArray", childField: "id", expand: ["productVariant"] },
  email: { field: "user", type: "object", childField: "email" },
  createdAt: { field: "createdAt", type: "date", operation: "gte" },
  updatedAt: { field: "updatedAt", type: "date", operation: "gte" },
};
