// src/mappings/product-update.mapping.ts

export const productVariantUpdateMapping = {
  // Campos simples
  name: { field: "name" },
  price: { field: "price" },
  profitMargin: { field: "profitMargin" },
  active: { field: "active" },
  contentMeasure: { field: "contentMeasure" },
  contentAmount: { field: "contentAmount" },
  requestTime: { field: "requestTime" },

  // Relaciones simples
  measureTypeId: { relation: true, connectField: "id" },

  stockIncrement: {
    transform: (qty: number, fullData: any) => ({
      currentStock: { increment: qty },

      movements: {
        create: {
          quantity: qty,
          type: fullData.movementType || (qty < 0 ? "OUT" : "IN"),
        },
      },
    }),
  },
  currentStock: {
    transform: (finalValue: number, fullData: any) => ({
      currentStock: finalValue,

      movements: {
        create: {
          quantity: finalValue,
          type: fullData.movementType || "ADJUSTMENT",
        },
      },
    }),
  },
};
