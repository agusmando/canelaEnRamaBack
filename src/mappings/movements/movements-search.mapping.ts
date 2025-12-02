export const movementSearchQueryMapping = {
  product: { field: "product", type: "object", childField: "name" },
  productId: { field: "productId", type: "number" },
  day: { field: "createdAt", type: "date", operation: "eq" },
  from: { field: "createdAt", type: "date", operation: "gte" },
  to: { field: "createdAt", type: "date", operation: "lte" },
  type: { field: "type", type: "enum" },
};
