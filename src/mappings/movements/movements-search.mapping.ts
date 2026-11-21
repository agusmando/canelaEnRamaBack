export const movementSearchQueryMapping = {
  productVariantId: { field: "productVariantId", type: "number" },
  // `expand` hace que el listado con detalle traiga productVariant.product (nombre del producto)
  variant: { field: "productVariant", type: "object", childField: "name", expand: ["product"] },
  search: { type: "textSearch", paths: [["productVariant", "name"], ["productVariant", "product", "name"]] },
  day: { field: "createdAt", type: "date", operation: "eq" },
  from: { field: "createdAt", type: "date", operation: "gte" },
  to: { field: "createdAt", type: "date", operation: "lte" },
  type: { field: "type", type: "enum" },
};
