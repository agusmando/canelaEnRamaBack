export const productUpdateMapping = {
  name: { field: "name" },
  description: { field: "description" },
  active: { field: "active" },
  // price: { field: "price" },
  // profitMargin: { field: "profitMargin" },

  // Relaciones simples
  measure: { field: "measure" },
  categoryId: { relation: true, connectField: "id" },
  Tags: { relation: true, connectField: "id" },
  brandId: { relation: true, connectField: "id" },
  // variants: { relation: true, connectField: "id" },

  // stockIncrement: {
  //   transform: (qty: number, fullData: any) => ({
  //     currentStock: { increment: qty },

  //     movements: {
  //       create: {
  //         quantity: qty,
  //         type: fullData.movementType || (qty < 0 ? "OUT" : "IN"),
  //       },
  //     },
  //   }),
  // },

  // currentStock: {
  //   transform: (finalValue: number, fullData: any) => ({
  //     currentStock: finalValue,

  //     movements: {
  //       create: {
  //         quantity: finalValue,
  //         type: fullData.movementType || "ADJUSTMENT",
  //       },
  //     },
  //   }),
  // },
};
