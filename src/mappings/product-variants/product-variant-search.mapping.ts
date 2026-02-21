export const productVariantSearchQueryMapping = {
  ofuscatedId: { field: "id", type: "number" }, // Not supposed to be used directly
  ofuscatedProductId: { field: "product", type: "number" }, // Not supposed to be used directly
  ofuscatedProduct: { field: "product", type: "object", childField: "name" },
  name: { field: "name", type: "string" },    
  ofuscatedProfitMargin: { field: "profitMargin", type: "number" }, // Not supposed to be used directly
  ofuscatedMeasure: { field: "contentMeasure", type: "string" }, // Not supposed to be used directly
  ofuscatedPackagingOptions: { field: "packagingOptions", type: "string" }, // Not supposed to be used directly
  minPrice: { field: "price", operation: "gte", type: "numberRange" },
  maxPrice: { field: "price", operation: "lte", type: "numberRange" },
  active: { field: "active", type: "boolean" },
  currentStock: { field: "currentStock", type: "number" },
  stockThreshold: { field: "currentStock", operation: "gte", type: "numberRange" },
  maxStock: { field: "currentStock", operation: "lte", type: "numberRange" },
  ofuscatedComponentOf: {
    field: "isComponentOf",
    type: "relationArray",
    childField: "mixVariantId",
    expand: ["mixVariant"],
  },
  ofuscatedHasComponents: {
    field: "hasComponents",
    type: "relationArray",
    childField: "productVariantId",
    expand: ["componentProduct"],
  },
  ofuscatedOffer: {
    field: "offers",
    type: "relationArray",
    childField: "id",
  },
  ofuscatedImages: {
    field: "images",
    type: "relationArray",
    childField: "id",
  },
  ofuscatedstockThreshold: { field: "stockThreshold", type: "number" },
  availableWeb: { field: "availableWeb", type: "boolean" },
  availablePedidosYa: { field: "availablePedidosYa", type: "boolean" },
};
