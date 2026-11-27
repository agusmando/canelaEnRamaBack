

export const orderSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" },
  // Búsqueda libre del panel: email/nombre del cliente, código de seguimiento o producto.
  q: {
    type: "search",
    fields: [
      { field: "user", childField: "email" },
      { field: "user", childField: "name" },
      { field: "shipment", childField: "trackingCode" },
      { field: "orderItems", childField: "productNameSnapshot", relation: "some" },
    ],
  },
  ofuscatedUser: { field: "user", type: "object"},
  userSuperTokensId: { field: "userSuperTokensId", type: "string" },
  ofuscatedItems: { field: "orderItems", type: "relationArray", childField: "id", expand: ["productVariant"] },
  createdAt: { field: "createdAt", type: "date", operation: "gte" },
  updatedAt: { field: "updatedAt", type: "date", operation: "gte" },
  status: { field: "status", type: "enum" },
  shippingMethod: { field: "shippingMethod", type: "enum" },
  channel: { field: "channel", type: "enum" },
  paymentType: { field: "paymentType", type: "string" },
  paymentStatus: { field: "paymentStatus", type: "enum" },
  totalPrice: { field: "totalPrice", type: "number", operation: "gte" },
  totalItems: { field: "totalItems", type: "number", operation: "gte" },
  estimatedReadyAt: { field: "estimatedReadyAt", type: "date", operation: "gte" },
};
