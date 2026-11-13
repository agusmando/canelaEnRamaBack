export const movementSearchQueryMapping = {
  productVariantId: { field: "productVariantId", type: "number" },
  variant: { field: "productVariant", type: "object", childField: "name" },
  day: { field: "createdAt", type: "date", operation: "eq" },
  from: { field: "createdAt", type: "date", operation: "gte" },
  to: { field: "createdAt", type: "date", operation: "lte" },
  type: { field: "type", type: "enum" },
};
