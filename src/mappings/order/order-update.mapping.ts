export const orderUpdateMapping = {
  // Relaciones simples
  userSuperTokensId: { relation: true, connectField: "id" },
  totalPrice: { field: "totalPrice" },
  totalItems: { field: "totalItems" },
  paymentType: { field: "paymentType" },
  status: { field: "status" },
  estimatedReadyAt: { field: "estimatedReadyAt" },

  // addItem?: CreateCartItemDto[];
  // removeItem?: number[];

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
