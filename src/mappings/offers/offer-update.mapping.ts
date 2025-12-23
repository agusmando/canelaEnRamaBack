export const productUpdateMapping = {
  // Campos simples
  startTime: { field: "startTime" },
  finishTime: { field: "finishTime" },
  discountValue: { field: "discountValue" },
  discountType: { field: "discountType" },
  discountQuantity: { field: "discountQuantity" },
  quantityToGet: { field: "quantityToGet" },
  stockThreshold: { field: "stockThreshold" },
  active: { field: "active" },  
  // Relaciones simples
  productId: { relation: true, connectField: "id" },
  productVariantId: { relation: true, connectField: "id" },
};
