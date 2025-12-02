export const productSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" }, // Not supposed to be used directly
  name: { field: "name", type: "string" },
  description: { field: "description", type: "string" },
  ofuscatedProfitMargin: { field: "profitMargin", type: "number" }, // Not supposed to be used directly
  ofuscatedMeasure: { field: "measure", type: "string" }, // Not supposed to be used directly
  ofuscatedMeasureContent: { field: "contentAmount", type: "string" }, // Not supposed to be used directly
  minPrice: { field: "price", operation: "gte", type: "numberRange" },
  maxPrice: { field: "price", operation: "lte", type: "numberRange" },
  active: { field: "active", type: "boolean" },
  category: { field: "Category", type: "object", childField: "name" },
  tags: { field: "Tags", type: "relationArray", childField: "name" },
  brand: { field: "Brand", type: "object", childField: "name" },
  currentStock: { field: "currentStock", type: "number" },
  minStock: { field: "currentStock", operation: "gte", type: "numberRange" },
  maxStock: { field: "currentStock", operation: "lte", type: "numberRange" },
};
